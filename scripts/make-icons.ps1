<#
    The app's icon: the header's own leaf
    ═════════════════════════════════════

    The manifest asked for /icons/icon-192.png and icon-512.png from the
    very beginning and neither file existed, so every page load fetched
    them and was refused — and anyone adding My Kutumbh to their home
    screen got a blank square. The browser tab had nothing either, and
    showed Chrome's generic globe.

    Rather than draw a leaf of my own, this renders the SAME glyph the
    app already uses in its header — U+1F33F, the herb — from Windows's
    own emoji font. Header and icon are then literally one mark.

    Windows draws it as a silhouette rather than in emoji colour, which
    suits an icon: one shape reads at thumbnail size where a picture
    does not. White on the header's deep purple.

    Run it from the project root:
      powershell -File scripts\make-icons.ps1

    Four files are written:
      public/icons/icon-192.png    the manifest's small icon
      public/icons/icon-512.png    the manifest's large icon, and splash
      src/app/icon.png             the browser tab
      src/app/apple-icon.png       iPhone home screens
#>

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

# The header's purple, and the leaf drawn on it
$INK  = [System.Windows.Media.Color]::FromRgb(0x24, 0x12, 0x38)
$MARK = [System.Windows.Media.Color]::FromRgb(0xFF, 0xFF, 0xFF)

# How much of the square the leaf fills. Comfortably inside the middle
# 80%, because Android crops a maskable icon to a circle.
$FILL = 0.56

function New-Icon {
    param([int]$Size, [string]$Path)

    $dpi = 96
    $visual = New-Object System.Windows.Media.DrawingVisual
    $dc = $visual.RenderOpen()

    $dc.DrawRectangle(
        (New-Object System.Windows.Media.SolidColorBrush $INK), $null,
        (New-Object System.Windows.Rect(0, 0, $Size, $Size))
    )

    $text = New-Object System.Windows.Media.FormattedText(
        [char]::ConvertFromUtf32(0x1F33F),
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Windows.FlowDirection]::LeftToRight,
        (New-Object System.Windows.Media.Typeface("Segoe UI Emoji")),
        ($Size * $FILL),
        (New-Object System.Windows.Media.SolidColorBrush $MARK),
        $dpi
    )

    $dc.DrawText($text, (New-Object System.Windows.Point(
        (($Size - $text.Width) / 2), (($Size - $text.Height) / 2)
    )))
    $dc.Close()

    $bitmap = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(
        $Size, $Size, $dpi, $dpi, [System.Windows.Media.PixelFormats]::Pbgra32
    )
    $bitmap.Render($visual)

    $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))

    $folder = Split-Path $Path -Parent
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }

    $stream = [System.IO.File]::Create($Path)
    $encoder.Save($stream)
    $stream.Close()

    "{0,-34} {1,6:N1} KB" -f (Resolve-Path $Path -Relative), ((Get-Item $Path).Length / 1KB)
}

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

New-Icon 192 (Join-Path $root "public\icons\icon-192.png")
New-Icon 512 (Join-Path $root "public\icons\icon-512.png")
New-Icon 64  (Join-Path $root "src\app\icon.png")
New-Icon 180 (Join-Path $root "src\app\apple-icon.png")
