param([Parameter(Mandatory=$true)][string]$Sdk, [Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
$Sdk=(Resolve-Path $Sdk).Path
$html=(Resolve-Path (Join-Path $PSScriptRoot "../index.html")).Path
$core="$Sdk/lib/net462/Microsoft.Web.WebView2.Core.dll"
$forms="$Sdk/lib/net462/Microsoft.Web.WebView2.WinForms.dll"
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe /platform:x64 /optimize+ "/win32icon:$PSScriptRoot/NauticaVolt.ico" "/out:$Out" /r:System.Windows.Forms.dll /r:System.Drawing.dll "/r:$core" "/r:$forms" "/resource:$core,Microsoft.Web.WebView2.Core.dll" "/resource:$forms,Microsoft.Web.WebView2.WinForms.dll" "/resource:$Sdk/runtimes/win-x64/native/WebView2Loader.dll,WebView2Loader.dll" "/resource:$Sdk/LICENSE.txt,WebView2-LICENSE.txt" "/resource:$Sdk/NOTICE.txt,WebView2-NOTICE.txt" "/resource:$html,index.html" "$PSScriptRoot\Studio.cs"
if($LASTEXITCODE){throw 'Error al compilar el ejecutable.'}
