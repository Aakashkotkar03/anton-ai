# native/CMakeLists.txt — Build config for Anton AI Shell Extension DLL
# Build on Windows only: cmake -B build -G "Visual Studio 17 2022" -A x64
#                        cmake --build build --config Release
#
# Output: build/Release/AntonAIShell.dll
# Register: regsvr32 AntonAIShell.dll (run as Administrator)
# Unregister: regsvr32 /u AntonAIShell.dll

cmake_minimum_required(VERSION 3.20)
project(AntonAIShell LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build as a shared library (DLL)
add_library(AntonAIShell SHARED
    shell_extension.cpp
    shell_extension.def
)

# Link Windows libraries
target_link_libraries(AntonAIShell PRIVATE
    shlwapi
    ole32
    uuid
)

# DLL properties
set_target_properties(AntonAIShell PROPERTIES
    OUTPUT_NAME "AntonAIShell"
    SUFFIX ".dll"
    # Minimize DLL size
    INTERPROCEDURAL_OPTIMIZATION TRUE
)

# Suppress CRT warnings for string functions
target_compile_definitions(AntonAIShell PRIVATE
    _CRT_SECURE_NO_WARNINGS
    UNICODE
    _UNICODE
)
