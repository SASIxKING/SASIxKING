package com.voltbill.pro.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

val Navy = Color(0xFF0F4C81)
val NavyDark = Color(0xFF0A3A63)
val NavyLight = Color(0xFFE8F0F8)
val Amber = Color(0xFFF2A20C)
val GreenOk = Color(0xFF1B7F4B)
val RedDue = Color(0xFFB3261E)
val Slate = Color(0xFF64748B)

private val Light = lightColorScheme(
    primary = Navy,
    onPrimary = Color.White,
    primaryContainer = NavyLight,
    onPrimaryContainer = NavyDark,
    secondary = Amber,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFDEFD3),
    onSecondaryContainer = Color(0xFF6B4700),
    tertiary = GreenOk,
    background = Color(0xFFF6F8FB),
    onBackground = Color(0xFF12181F),
    surface = Color.White,
    onSurface = Color(0xFF12181F),
    surfaceVariant = Color(0xFFEDF1F6),
    onSurfaceVariant = Slate,
    error = RedDue,
    outline = Color(0xFFD5DBE3)
)

private val Dark = darkColorScheme(
    primary = Color(0xFF9CC7F2),
    onPrimary = Color(0xFF04304F),
    primaryContainer = Color(0xFF15405F),
    onPrimaryContainer = Color(0xFFD3E4F7),
    secondary = Amber,
    onSecondary = Color(0xFF3B2A00),
    tertiary = Color(0xFF6FD79B),
    background = Color(0xFF0E1418),
    onBackground = Color(0xFFE2E7EC),
    surface = Color(0xFF151C22),
    onSurface = Color(0xFFE2E7EC),
    surfaceVariant = Color(0xFF222C34),
    onSurfaceVariant = Color(0xFFA9B6C2),
    error = Color(0xFFFFB4AB),
    outline = Color(0xFF3A464F)
)

private val AppTypography = Typography(
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp),
    bodyMedium = TextStyle(fontSize = 13.5.sp),
    bodySmall = TextStyle(fontSize = 12.sp),
    labelLarge = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
    labelSmall = TextStyle(fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
)

@Composable
fun VoltBillTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) Dark else Light
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colors.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }
    MaterialTheme(colorScheme = colors, typography = AppTypography, content = content)
}
