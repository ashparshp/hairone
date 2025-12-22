import cairosvg
import os

# Define the target directory
OUTPUT_DIR = "hairone-frontend/assets/images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Define the SVG content for the icon (Emblem Only, centered on square)
# The original emblem circle radius is 70.
# We need to center it in a 1024x1024 viewBox.
# 1024 / 2 = 512. So center is (512, 512).
# We scale it up to fill the space nicely.
# Original Radius 70. Let's scale by ~5x -> Radius 350 (Diameter 700), leaving ~160px padding.

svg_icon_content = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect x="0" y="0" width="1024" height="1024" fill="#000000"/>
  <g transform="translate(512, 512) scale(5)">
    <circle cx="0" cy="0" r="70" fill="#D4AF37"/>
    <g fill="#FFFFFF">
        <path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" />
        <rect x="-10" y="-15" width="6" height="40" rx="3" />
        <rect x="4" y="-15" width="6" height="40" rx="3" />
        <rect x="-24" y="-5" width="6" height="30" rx="3" />
        <rect x="18" y="-5" width="6" height="30" rx="3" />
    </g>
  </g>
</svg>
"""

# Favicon (Small 48x48)
svg_favicon_content = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="48" height="48">
  <rect x="0" y="0" width="1024" height="1024" fill="#000000"/>
  <g transform="translate(512, 512) scale(5)">
    <circle cx="0" cy="0" r="70" fill="#D4AF37"/>
    <g fill="#FFFFFF">
        <path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" />
        <rect x="-10" y="-15" width="6" height="40" rx="3" />
        <rect x="4" y="-15" width="6" height="40" rx="3" />
        <rect x="-24" y="-5" width="6" height="30" rx="3" />
        <rect x="18" y="-5" width="6" height="30" rx="3" />
    </g>
  </g>
</svg>
"""

# Splash Icon (Includes Text "hairone", White Text)
# ViewBox matches Logo.tsx logic (512x200), scaled up.
# Logo.tsx: viewBox="0 0 512 200".
# Let's use 1024x400 for better resolution or keep aspect ratio.
# We will use the same viewBox but scale it.
svg_splash_content = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 200" width="512" height="200">
  <g transform="translate(80, 100)">
    <circle cx="0" cy="0" r="70" fill="#D4AF37" />
    <g fill="#FFFFFF">
      <path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" />
      <rect x="-10" y="-15" width="6" height="40" rx="3" />
      <rect x="4" y="-15" width="6" height="40" rx="3" />
      <rect x="-24" y="-5" width="6" height="30" rx="3" />
      <rect x="18" y="-5" width="6" height="30" rx="3" />
    </g>
  </g>

  <g transform="translate(180, 125)">
    <text font-family="Helvetica, Arial, sans-serif" font-size="80" font-weight="bold" fill="#FFFFFF">
      hair<tspan fill="#D4AF37">one</tspan>
    </text>
  </g>
</svg>
"""

def generate_icons():
    print("Generating icons...")

    # Generate Main Icon
    icon_path = os.path.join(OUTPUT_DIR, "icon.png")
    cairosvg.svg2png(bytestring=svg_icon_content, write_to=icon_path)
    print(f"Generated {icon_path}")

    # Generate Adaptive Icon (Same for now, centered emblem)
    adaptive_path = os.path.join(OUTPUT_DIR, "adaptive-icon.png")
    cairosvg.svg2png(bytestring=svg_icon_content, write_to=adaptive_path)
    print(f"Generated {adaptive_path}")

    # Generate Favicon
    favicon_path = os.path.join(OUTPUT_DIR, "favicon.png")
    cairosvg.svg2png(bytestring=svg_favicon_content, write_to=favicon_path)
    print(f"Generated {favicon_path}")

    # Generate Splash Icon
    splash_path = os.path.join(OUTPUT_DIR, "splash-icon.png")
    cairosvg.svg2png(bytestring=svg_splash_content, write_to=splash_path)
    print(f"Generated {splash_path}")

if __name__ == "__main__":
    generate_icons()
