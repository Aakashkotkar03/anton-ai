; build/nsis-shell-extension.nsh — Custom NSIS script for shell extension DLL
; Registers AntonAIShell.dll during install, unregisters during uninstall.
; Electron-builder injects this via the 'include' option in nsis config.

!macro customInstall
  ; Register the shell extension DLL
  ; The DLL is copied to resources/native/ by electron-builder extraResources
  nsExec::ExecToLog 'regsvr32 /s "$INSTDIR\resources\native\AntonAIShell.dll"'
!macroend

!macro customUnInstall
  ; Unregister the shell extension DLL before removal
  nsExec::ExecToLog 'regsvr32 /s /u "$INSTDIR\resources\native\AntonAIShell.dll"'
!macroend
