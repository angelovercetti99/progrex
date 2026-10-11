# Archivo Wide

`ArchivoWide-700.ttf` and `ArchivoWide-800.ttf` are static instances of Archivo
(Omnibus-Type, SIL Open Font License 1.1, see `ArchivoWide-OFL.txt`) at width 118.

React Native can't set a variable font's width axis, so we cut fixed files from the
variable font published by Google Fonts (`ofl/archivo/Archivo[wdth,wght].ttf`):

    fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=118 wght=800 -o ArchivoWide-800.ttf
