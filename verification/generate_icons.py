import os
import cairosvg

def generate_icons():
    # Colors
    GOLD = "#D4AF37"
    BLACK = "#000000"
    WHITE = "#FFFFFF"

    # Ensure assets directory exists
    output_dir = "hairone-frontend/assets/images"
    os.makedirs(output_dir, exist_ok=True)

    # ---------------------------------------------------------
    # 1. APP ICON & ADAPTIVE ICON (Symbol Only - No Text)
    # ---------------------------------------------------------
    # A simple, bold icon for the launcher.
    # Circle centered, Scissors inside.

    svg_icon_content = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
      <!-- Background Rect for non-transparent usage (e.g. iOS icon, or adaptive background)
           Note: For adaptive-icon.png in Expo, transparency is often preferred if using a separate background color,
           but including a black background ensures consistency if the mask is large.
           However, user reported 'white square'. We will enforce black background here.
      -->
      <rect x="0" y="0" width="1024" height="1024" fill="{BLACK}"/>

      <!-- Central Circle (Gold) -->
      <circle cx="512" cy="512" r="400" fill="{GOLD}"/>

      <!-- Scissors / Comb Symbol (White) inside the circle -->
      <g transform="translate(512, 512) scale(3.5)">
        <g transform="translate(0, 0)">
             <!-- Simplified Scissors/Comb representation matching Logo.tsx path roughly -->
             <!-- Path d from Logo.tsx: M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z -->
             <path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" fill="{WHITE}" />
             <!-- Comb Teeth -->
             <rect x="-10" y="-15" width="6" height="40" rx="3" fill="{WHITE}" />
             <rect x="4" y="-15" width="6" height="40" rx="3" fill="{WHITE}" />
             <rect x="-24" y="-5" width="6" height="30" rx="3" fill="{WHITE}" />
             <rect x="18" y="-5" width="6" height="30" rx="3" fill="{WHITE}" />
        </g>
      </g>
    </svg>
    """

    # Generate Standard Icon
    cairosvg.svg2png(bytestring=svg_icon_content, write_to=f"{output_dir}/icon.png")
    print(f"Generated {output_dir}/icon.png")

    # Generate Adaptive Icon (Foreground)
    # Ideally transparent background, but user had issues. We will use the same full icon for now
    # OR we can make a transparent version if we trust the color in app.json.
    # Given the user reported "white square" (likely missing resource or bad transparency),
    # let's provide the FULL black icon as the adaptive foreground.
    # Android will crop it to a circle/squircle. The corners will be black, matching the background #000000.
    cairosvg.svg2png(bytestring=svg_icon_content, write_to=f"{output_dir}/adaptive-icon.png")
    print(f"Generated {output_dir}/adaptive-icon.png")


    # ---------------------------------------------------------
    # 2. SPLASH SCREEN ICON (Full Logo with Text)
    # ---------------------------------------------------------
    # Layout based on Logo.tsx: Circle/Icon on left, Text on right.
    # Scaled to fit 1024x1024 but vertically centered.

    # Logo.tsx viewbox 0 0 512 200.
    # We will center this 512x200 area inside 1024x1024.
    # Scale x1.5 -> 768x300.

    svg_splash_content = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
      <!-- Transparent background - app.json sets background to #000000 -->

      <!-- Group centered in 1024x1024 -->
      <!-- Translating to center the roughly 512x200 content scaled by 1.5 -->
      <!-- 512*1.5 = 768 width. (1024-768)/2 = 128 offset X -->
      <!-- 200*1.5 = 300 height. (1024-300)/2 = 362 offset Y -->

      <g transform="translate(128, 362) scale(1.5)">

        <!-- COPIED FROM LOGO.TSX LOGIC -->

        <!-- Icon Group: Translate(80, 100) -->
        <g transform="translate(80, 100)">
            <circle cx="0" cy="0" r="70" fill="{GOLD}" />
            <g fill="{WHITE}">
                 <!-- Note: Splash text is WHITE because bg is BLACK -->
                 <path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" />
                 <rect x="-10" y="-15" width="6" height="40" rx="3" />
                 <rect x="4" y="-15" width="6" height="40" rx="3" />
                 <rect x="-24" y="-5" width="6" height="30" rx="3" />
                 <rect x="18" y="-5" width="6" height="30" rx="3" />
            </g>
        </g>

        <!-- Text Group: Translate(180, 125) -->
        <g transform="translate(180, 125)">
            <text font-family="Helvetica, Arial, sans-serif" font-size="80" font-weight="bold" fill="{WHITE}">
                hair<tspan fill="{GOLD}">one</tspan>
            </text>
        </g>

      </g>
    </svg>
    """

    cairosvg.svg2png(bytestring=svg_splash_content, write_to=f"{output_dir}/splash-icon.png")
    print(f"Generated {output_dir}/splash-icon.png")

    # Favicon (Small version of icon)
    cairosvg.svg2png(bytestring=svg_icon_content, write_to=f"{output_dir}/favicon.png", output_width=48, output_height=48)
    print(f"Generated {output_dir}/favicon.png")

if __name__ == "__main__":
    generate_icons()
