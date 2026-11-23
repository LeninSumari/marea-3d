# Náutica Volt

Laboratorio 3D de energía hidrocinética para la expoferia de Ingeniería en Energías Renovables de la Universidad Nacional de Juliaca.

- [Abrir el simulador web](https://leninsumari.github.io/marea-3d/)
- [Descargar el programa para Windows x64](https://github.com/LeninSumari/marea-3d/releases/download/v2.1.0/NauticaVolt-Windows-x64.exe)

El programa funciona sin conexión y utiliza Microsoft Edge WebView2 Runtime x64 y .NET Framework 4.6.2 o posterior. El archivo HTML de la raíz también se puede abrir sin conexión con un navegador compatible con WebGL 2.

Pulsa **Presentar** para proyectar cinco láminas sobre el prototipo, la construcción del tanque, la escala marina, los rotores y el presupuesto. Usa las flechas para avanzar o retroceder. Las cifras corresponden al modelo educativo.

## Compilación

Desde `desarrollo/`, ejecuta `npm ci` y `npm run build` para regenerar el archivo portátil `index.html` de la raíz. Usa `npm run dev` para iniciar el entorno de desarrollo.

Para generar el ejecutable en Windows de 64 bits, extrae el paquete NuGet Microsoft.Web.WebView2 1.0.2903.40 en una carpeta. Desde PowerShell, ejecuta `./windows/build.ps1 -Sdk RUTA_DEL_SDK -Out NauticaVolt-Windows-x64.exe`.
