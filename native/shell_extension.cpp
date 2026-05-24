// native/shell_extension.cpp — Windows Shell Extension DLL (PRD Feature 8)
// Registers "Anton AI" submenu in the Windows right-click context menu.
// Communicates with the Electron main process via a Named Pipe.
//
// Actions: Fix Writing, Make Shorter, Make Formal, Explain This, Translate
//
// Build: compiled on Windows only via CMake → produces AntonAIShell.dll
// Registration: regsvr32 AntonAIShell.dll (done by NSIS installer)
//
// Architecture:
//   1. User selects text in any app → right-clicks
//   2. Windows loads this DLL → shows "Anton AI" submenu
//   3. User clicks an action (e.g. "Fix Writing")
//   4. DLL reads selected text via clipboard (SendMessage WM_COPY)
//   5. DLL sends { action, text } to \\.\pipe\antonai_context
//   6. Electron namedPipeServer receives → processes via singleShot
//   7. Result written to clipboard → toast shown by Electron
//
// 🔒 Security:
//   - Named pipe name is hardcoded — no user input in pipe path
//   - Text size capped at 50,000 chars before sending
//   - DLL only sends to a local named pipe — no network access

#include <windows.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <strsafe.h>
#include <string>

#pragma comment(lib, "shlwapi.lib")

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
static const wchar_t* PIPE_NAME = L"\\\\.\\pipe\\antonai_context";
static const DWORD MAX_TEXT_LENGTH = 50000;
static const DWORD PIPE_TIMEOUT_MS = 5000;

// Menu command IDs
#define IDM_ANTONAI_FIX       0x0001
#define IDM_ANTONAI_SHORTEN   0x0002
#define IDM_ANTONAI_FORMAL    0x0003
#define IDM_ANTONAI_EXPLAIN   0x0004
#define IDM_ANTONAI_TRANSLATE 0x0005

// GUID for this shell extension — generated, unique to Anton AI
// {A7B3C4D5-E6F7-4890-AB12-CD34EF56AB78}
static const CLSID CLSID_AntonAIShellExt =
    {0xA7B3C4D5, 0xE6F7, 0x4890, {0xAB, 0x12, 0xCD, 0x34, 0xEF, 0x56, 0xAB, 0x78}};

// ---------------------------------------------------------------------------
// DLL globals
// ---------------------------------------------------------------------------
static HINSTANCE g_hInst = NULL;
static LONG g_cDllRef = 0;

// ---------------------------------------------------------------------------
// Helper: Send a message to the Anton AI named pipe
// ---------------------------------------------------------------------------
static bool SendToPipe(const char* action, const std::wstring& text) {
    // Connect to the named pipe
    HANDLE hPipe = CreateFileW(
        PIPE_NAME,
        GENERIC_WRITE,
        0,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (hPipe == INVALID_HANDLE_VALUE) {
        // Anton AI is not running — pipe doesn't exist
        return false;
    }

    // Build JSON payload: { "action": "...", "text": "..." }
    // Convert wide text to UTF-8
    int utf8Len = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, NULL, 0, NULL, NULL);
    if (utf8Len <= 0 || utf8Len > (int)MAX_TEXT_LENGTH) {
        CloseHandle(hPipe);
        return false;
    }

    std::string utf8Text(utf8Len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, &utf8Text[0], utf8Len, NULL, NULL);
    // Remove null terminator from the string length
    if (!utf8Text.empty() && utf8Text.back() == '\0') {
        utf8Text.pop_back();
    }

    // Escape JSON special characters (basic: backslash, quote, newline, tab)
    std::string escaped;
    escaped.reserve(utf8Text.size() + 64);
    for (char c : utf8Text) {
        switch (c) {
            case '\\': escaped += "\\\\"; break;
            case '"':  escaped += "\\\""; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default:   escaped += c; break;
        }
    }

    std::string json = "{\"action\":\"";
    json += action;
    json += "\",\"text\":\"";
    json += escaped;
    json += "\"}";

    // Write to pipe
    DWORD bytesWritten = 0;
    BOOL success = WriteFile(
        hPipe,
        json.c_str(),
        (DWORD)json.size(),
        &bytesWritten,
        NULL
    );

    CloseHandle(hPipe);
    return success && (bytesWritten == (DWORD)json.size());
}

// ---------------------------------------------------------------------------
// Helper: Get the currently selected text via clipboard
// ---------------------------------------------------------------------------
static std::wstring GetSelectedText(HWND hwnd) {
    // Save current clipboard contents
    // Send Ctrl+C to the foreground window to copy selection
    // Then read clipboard

    if (!OpenClipboard(NULL)) return L"";

    // Check if there's already text (from user's Ctrl+C)
    HANDLE hData = GetClipboardData(CF_UNICODETEXT);
    if (hData == NULL) {
        CloseClipboard();
        return L"";
    }

    wchar_t* pText = static_cast<wchar_t*>(GlobalLock(hData));
    if (pText == NULL) {
        CloseClipboard();
        return L"";
    }

    std::wstring text(pText);
    GlobalUnlock(hData);
    CloseClipboard();

    // Cap at MAX_TEXT_LENGTH
    if (text.size() > MAX_TEXT_LENGTH) {
        text.resize(MAX_TEXT_LENGTH);
    }

    return text;
}

// ---------------------------------------------------------------------------
// IContextMenu implementation
// ---------------------------------------------------------------------------
class AntonAIShellExt : public IShellExtInit, public IContextMenu {
public:
    // IUnknown
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv) {
        static const QITAB qit[] = {
            QITABENT(AntonAIShellExt, IShellExtInit),
            QITABENT(AntonAIShellExt, IContextMenu),
            {0},
        };
        return QISearch(this, qit, riid, ppv);
    }

    IFACEMETHODIMP_(ULONG) AddRef() {
        return InterlockedIncrement(&m_cRef);
    }

    IFACEMETHODIMP_(ULONG) Release() {
        LONG cRef = InterlockedDecrement(&m_cRef);
        if (cRef == 0) {
            delete this;
        }
        return cRef;
    }

    // IShellExtInit
    IFACEMETHODIMP Initialize(PCIDLIST_ABSOLUTE, IDataObject*, HKEY) {
        return S_OK;
    }

    // IContextMenu — add our menu items
    IFACEMETHODIMP QueryContextMenu(HMENU hmenu, UINT indexMenu,
                                     UINT idCmdFirst, UINT idCmdLast, UINT uFlags) {
        if (uFlags & CMF_DEFAULTONLY) return MAKE_HRESULT(SEVERITY_SUCCESS, 0, 0);

        // Create submenu
        HMENU hSubmenu = CreatePopupMenu();
        if (!hSubmenu) return MAKE_HRESULT(SEVERITY_SUCCESS, 0, 0);

        // Add actions to submenu
        InsertMenuW(hSubmenu, 0, MF_BYPOSITION | MF_STRING,
                    idCmdFirst + IDM_ANTONAI_FIX, L"Fix Writing");
        InsertMenuW(hSubmenu, 1, MF_BYPOSITION | MF_STRING,
                    idCmdFirst + IDM_ANTONAI_SHORTEN, L"Make Shorter");
        InsertMenuW(hSubmenu, 2, MF_BYPOSITION | MF_STRING,
                    idCmdFirst + IDM_ANTONAI_FORMAL, L"Make Formal");
        InsertMenuW(hSubmenu, 3, MF_BYPOSITION | MF_STRING,
                    idCmdFirst + IDM_ANTONAI_EXPLAIN, L"Explain This");
        InsertMenuW(hSubmenu, 4, MF_BYPOSITION | MF_STRING,
                    idCmdFirst + IDM_ANTONAI_TRANSLATE, L"Translate");

        // Insert "Anton AI" parent menu item with submenu
        MENUITEMINFOW mii = {};
        mii.cbSize = sizeof(MENUITEMINFOW);
        mii.fMask = MIIM_STRING | MIIM_SUBMENU | MIIM_ID;
        mii.wID = idCmdFirst;
        mii.hSubMenu = hSubmenu;
        mii.dwTypeData = const_cast<LPWSTR>(L"Anton AI");

        InsertMenuItemW(hmenu, indexMenu, TRUE, &mii);

        // Return the number of menu items added (5 actions + 1 parent = 6)
        return MAKE_HRESULT(SEVERITY_SUCCESS, 0, IDM_ANTONAI_TRANSLATE + 1);
    }

    // IContextMenu — execute the selected action
    IFACEMETHODIMP InvokeCommand(CMINVOKECOMMANDINFO* pici) {
        if (HIWORD(pici->lpVerb) != 0) return E_INVALIDARG;

        const char* action = nullptr;
        switch (LOWORD(pici->lpVerb)) {
            case IDM_ANTONAI_FIX:       action = "clipboard-improve"; break;
            case IDM_ANTONAI_SHORTEN:   action = "clipboard-shorten"; break;
            case IDM_ANTONAI_FORMAL:    action = "clipboard-formal";  break;
            case IDM_ANTONAI_EXPLAIN:   action = "clipboard-explain"; break;
            case IDM_ANTONAI_TRANSLATE: action = "clipboard-translate"; break;
            default: return E_INVALIDARG;
        }

        // Get the selected text from clipboard
        std::wstring text = GetSelectedText(pici->hwnd);
        if (text.empty()) {
            MessageBoxW(pici->hwnd,
                L"No text selected. Copy some text first (Ctrl+C), then try again.",
                L"Anton AI", MB_OK | MB_ICONINFORMATION);
            return S_OK;
        }

        // Send to Anton AI via named pipe
        if (!SendToPipe(action, text)) {
            MessageBoxW(pici->hwnd,
                L"Anton AI is not running. Open the app and try again.",
                L"Anton AI", MB_OK | MB_ICONWARNING);
        }

        return S_OK;
    }

    // IContextMenu — help text (tooltip)
    IFACEMETHODIMP GetCommandString(UINT_PTR, UINT uType, UINT*, LPSTR, UINT) {
        if (uType == GCS_HELPTEXTW) {
            // Could return help text per command — skip for v1.0
        }
        return E_NOTIMPL;
    }

    AntonAIShellExt() : m_cRef(1) {
        InterlockedIncrement(&g_cDllRef);
    }

protected:
    ~AntonAIShellExt() {
        InterlockedDecrement(&g_cDllRef);
    }

private:
    LONG m_cRef;
};

// ---------------------------------------------------------------------------
// Class factory
// ---------------------------------------------------------------------------
class AntonAIClassFactory : public IClassFactory {
public:
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv) {
        static const QITAB qit[] = {
            QITABENT(AntonAIClassFactory, IClassFactory),
            {0},
        };
        return QISearch(this, qit, riid, ppv);
    }

    IFACEMETHODIMP_(ULONG) AddRef()  { return InterlockedIncrement(&m_cRef); }
    IFACEMETHODIMP_(ULONG) Release() {
        LONG cRef = InterlockedDecrement(&m_cRef);
        if (cRef == 0) delete this;
        return cRef;
    }

    IFACEMETHODIMP CreateInstance(IUnknown* pUnkOuter, REFIID riid, void** ppv) {
        if (pUnkOuter) return CLASS_E_NOAGGREGATION;
        AntonAIShellExt* pExt = new (std::nothrow) AntonAIShellExt();
        if (!pExt) return E_OUTOFMEMORY;
        HRESULT hr = pExt->QueryInterface(riid, ppv);
        pExt->Release();
        return hr;
    }

    IFACEMETHODIMP LockServer(BOOL fLock) {
        if (fLock) InterlockedIncrement(&g_cDllRef);
        else       InterlockedDecrement(&g_cDllRef);
        return S_OK;
    }

    AntonAIClassFactory() : m_cRef(1) { InterlockedIncrement(&g_cDllRef); }

protected:
    ~AntonAIClassFactory() { InterlockedDecrement(&g_cDllRef); }

private:
    LONG m_cRef;
};

// ---------------------------------------------------------------------------
// DLL exports
// ---------------------------------------------------------------------------
BOOL APIENTRY DllMain(HINSTANCE hInstDLL, DWORD fdwReason, LPVOID) {
    if (fdwReason == DLL_PROCESS_ATTACH) {
        g_hInst = hInstDLL;
        DisableThreadLibraryCalls(hInstDLL);
    }
    return TRUE;
}

STDAPI DllCanUnloadNow() {
    return g_cDllRef == 0 ? S_OK : S_FALSE;
}

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void** ppv) {
    if (!IsEqualCLSID(rclsid, CLSID_AntonAIShellExt)) return CLASS_E_CLASSNOTAVAILABLE;
    AntonAIClassFactory* pFactory = new (std::nothrow) AntonAIClassFactory();
    if (!pFactory) return E_OUTOFMEMORY;
    HRESULT hr = pFactory->QueryInterface(riid, ppv);
    pFactory->Release();
    return hr;
}

// ---------------------------------------------------------------------------
// Self-registration (called by regsvr32)
// ---------------------------------------------------------------------------
STDAPI DllRegisterServer() {
    wchar_t dllPath[MAX_PATH];
    GetModuleFileNameW(g_hInst, dllPath, MAX_PATH);

    // Convert CLSID to string
    wchar_t clsidStr[64];
    StringFromGUID2(CLSID_AntonAIShellExt, clsidStr, 64);

    HKEY hKey;
    wchar_t keyPath[256];

    // Register CLSID
    StringCchPrintfW(keyPath, 256, L"CLSID\\%s", clsidStr);
    RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)L"Anton AI Shell Extension",
                   sizeof(L"Anton AI Shell Extension"));
    RegCloseKey(hKey);

    // Register InProcServer32
    StringCchPrintfW(keyPath, 256, L"CLSID\\%s\\InProcServer32", clsidStr);
    RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)dllPath, (DWORD)(wcslen(dllPath) + 1) * sizeof(wchar_t));
    RegSetValueExW(hKey, L"ThreadingModel", 0, REG_SZ, (BYTE*)L"Apartment", sizeof(L"Apartment"));
    RegCloseKey(hKey);

    // Register as context menu handler for all files
    StringCchPrintfW(keyPath, 256, L"*\\shellex\\ContextMenuHandlers\\AntonAI");
    RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)clsidStr, (DWORD)(wcslen(clsidStr) + 1) * sizeof(wchar_t));
    RegCloseKey(hKey);

    // Also register for directory background
    StringCchPrintfW(keyPath, 256, L"Directory\\Background\\shellex\\ContextMenuHandlers\\AntonAI");
    RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExW(hKey, NULL, 0, REG_SZ, (BYTE*)clsidStr, (DWORD)(wcslen(clsidStr) + 1) * sizeof(wchar_t));
    RegCloseKey(hKey);

    // Approve the extension (required for some Windows versions)
    RegCreateKeyExW(HKEY_LOCAL_MACHINE,
        L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Shell Extensions\\Approved",
        0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    RegSetValueExW(hKey, clsidStr, 0, REG_SZ, (BYTE*)L"Anton AI Shell Extension",
                   sizeof(L"Anton AI Shell Extension"));
    RegCloseKey(hKey);

    // Notify shell of change
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL);

    return S_OK;
}

STDAPI DllUnregisterServer() {
    wchar_t clsidStr[64];
    StringFromGUID2(CLSID_AntonAIShellExt, clsidStr, 64);

    wchar_t keyPath[256];

    // Remove context menu handler registrations
    RegDeleteTreeW(HKEY_CLASSES_ROOT, L"*\\shellex\\ContextMenuHandlers\\AntonAI");
    RegDeleteTreeW(HKEY_CLASSES_ROOT, L"Directory\\Background\\shellex\\ContextMenuHandlers\\AntonAI");

    // Remove CLSID
    StringCchPrintfW(keyPath, 256, L"CLSID\\%s", clsidStr);
    RegDeleteTreeW(HKEY_CLASSES_ROOT, keyPath);

    // Remove approval
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE,
        L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Shell Extensions\\Approved",
        0, KEY_WRITE, &hKey) == ERROR_SUCCESS) {
        RegDeleteValueW(hKey, clsidStr);
        RegCloseKey(hKey);
    }

    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL);
    return S_OK;
}
