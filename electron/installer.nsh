; ─────────────────────────────────────────────────────────────
; Ruflo Mission Control — Custom NSIS installer logic
; Checks for Node.js, ruflo, openclaw and installs only what's missing
; ─────────────────────────────────────────────────────────────

!macro customInstall
  ; ── Check for Node.js ─────────────────────────────────────
  DetailPrint "Checking for Node.js..."
  nsExec::ExecToStack 'node --version'
  Pop $0  ; exit code
  Pop $1  ; output

  ${If} $0 != 0
    DetailPrint "Node.js not found — downloading installer..."
    inetc::get "https://nodejs.org/dist/latest-lts/win-x64/node.exe" "$TEMP\node_installer.exe" /END
    ExecWait '"$TEMP\node_installer.exe" /silent /install' $0
    DetailPrint "Node.js installed (exit $0)"
    Delete "$TEMP\node_installer.exe"
  ${Else}
    DetailPrint "Node.js already installed: $1"
  ${EndIf}

  ; ── Check for ruflo / claude-flow ─────────────────────────
  DetailPrint "Checking for ruflo..."
  nsExec::ExecToStack 'npx claude-flow --version'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "Installing ruflo..."
    nsExec::ExecToLog 'npm install -g ruflo'
    DetailPrint "Ruflo installed."
  ${Else}
    DetailPrint "Ruflo already installed: $1"
  ${EndIf}

  ; ── Check for OpenClaw ────────────────────────────────────
  DetailPrint "Checking for OpenClaw..."
  nsExec::ExecToStack 'npx openclaw --version'
  Pop $0
  Pop $1

  StrCpy $2 "2026.3.22"   ; target version
  ${If} $0 != 0
    DetailPrint "OpenClaw not found — installing $2..."
    nsExec::ExecToLog 'npm install -g openclaw@$2'
    DetailPrint "OpenClaw $2 installed."
  ${ElseIf} $1 != $2
    DetailPrint "OpenClaw $1 found, updating to $2..."
    nsExec::ExecToLog 'npm install -g openclaw@$2'
    DetailPrint "OpenClaw updated to $2."
  ${Else}
    DetailPrint "OpenClaw $2 already installed — skipping."
  ${EndIf}

  ; ── Create tasks output folder ────────────────────────────
  CreateDirectory "$APPDATA\Ruflo Mission Control\tasks"
  CreateDirectory "$APPDATA\Ruflo Mission Control\skills"
  DetailPrint "Output folders created."

  ; ── Write default settings.json if not exists ─────────────
  IfFileExists "$APPDATA\Ruflo Mission Control\settings.json" settings_exist settings_missing
  settings_missing:
    FileOpen $3 "$APPDATA\Ruflo Mission Control\settings.json" w
    FileWrite $3 '{"apiKeys":{"anthropic":"","openai":"","github":"","openrouter":""},"social":{"discord":{"webhook":"","botToken":""},"twitter":{"apiKey":"","bearerToken":""},"slack":{"webhook":"","channel":""}},"openclaw":{"enabled":true,"targetVersion":"2026.3.22"},"general":{"timezone":"Asia/Kuala_Lumpur","port":3847}}'
    FileClose $3
    DetailPrint "Default settings.json created."
  settings_exist:
    DetailPrint "Settings file already exists — preserved."

!macroend

!macro customUnInstall
  ; Leave user data (tasks, skills, settings) intact on uninstall
  DetailPrint "Ruflo Mission Control uninstalled. Your tasks and settings are preserved in $APPDATA\Ruflo Mission Control"
!macroend
