import os

BASE = "/home/claude/foodtrip-house-pos/frontend/public/images/products"

# Consistent square canvas + warm background circle used across every product image,
# so the whole catalog reads as one visual set even though each icon differs.
def wrap(inner, bg1="#FFE8CC", bg2="#FFD8A8"):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="{bg1}"/>
      <stop offset="100%" stop-color="{bg2}"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#00000022"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <ellipse cx="200" cy="330" rx="140" ry="18" fill="#00000012"/>
  <g filter="url(#soft)">
    {inner}
  </g>
</svg>'''

def burger(cheese=False, veg=False, double=False):
    def one(ox):
        parts = f'''
      <ellipse cx="{ox}" cy="255" rx="95" ry="24" fill="#C97A32"/>
      <path d="M {ox-95} 205 Q {ox-95} 155 {ox} 150 Q {ox+95} 155 {ox+95} 205 Z" fill="#E3A458"/>
      <ellipse cx="{ox-40}" cy="170" rx="6" ry="4" fill="#FBEAC9"/>
      <ellipse cx="{ox+10}" cy="163" rx="6" ry="4" fill="#FBEAC9"/>
      <ellipse cx="{ox+50}" cy="172" rx="6" ry="4" fill="#FBEAC9"/>
      <rect x="{ox-95}" y="205" width="190" height="16" rx="6" fill="#8C5A2B"/>
      '''
        if veg:
            parts += f'<path d="M {ox-95} 218 q 20 -14 40 0 q 20 -14 40 0 q 20 -14 40 0 q 20 -14 30 0 l 0 12 l -150 0 Z" fill="#6BAA3C"/>'
        parts += f'<rect x="{ox-95}" y="228" width="190" height="18" rx="4" fill="#7A3E1D"/>'
        if cheese:
            parts += f'<path d="M {ox-95} 246 l 190 0 l -14 22 l -162 0 Z" fill="#FFC94A"/>'
        parts += f'<ellipse cx="{ox}" cy="288" rx="88" ry="20" fill="#F1C27D"/>'
        return parts

    if double:
        return one(120) + one(280).replace('id="soft"', '')
    return one(200)

def fries(large=False):
    h = 150 if large else 120
    sticks = "".join(
        f'<rect x="{150+i*14}" y="{260-h+ (i%3)*10}" width="12" height="{h - (i%3)*10}" rx="3" fill="#F7C34B" stroke="#E0A72E" stroke-width="2"/>'
        for i in range(8)
    )
    return f'''
    <path d="M140 260 L260 260 L245 340 Q200 355 155 340 Z" fill="#E85D04"/>
    <path d="M140 260 L260 260 L255 275 L145 275 Z" fill="#C94A02"/>
    {sticks}
    '''

def drink_cup(color1, color2, straw=True):
    straw_svg = '<rect x="195" y="90" width="10" height="70" rx="4" fill="#fff" transform="rotate(12 200 120)"/>' if straw else ''
    return f'''
    <path d="M150 140 L250 140 L235 300 Q200 315 165 300 Z" fill="url(#cup)"/>
    <defs><linearGradient id="cup" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{color1}"/><stop offset="100%" stop-color="{color2}"/>
    </linearGradient></defs>
    <ellipse cx="200" cy="140" rx="50" ry="14" fill="#ffffffaa"/>
    <path d="M150 140 L250 140 L246 160 L154 160 Z" fill="#ffffff55"/>
    {straw_svg}
    '''

def siomai():
    dumplings = "".join(
        f'<ellipse cx="{160+i*40}" cy="{240 - (i%2)*14}" rx="26" ry="22" fill="#F2C879" stroke="#D9A94D" stroke-width="3"/>'
        for i in range(4)
    )
    return f'''
    <ellipse cx="200" cy="290" rx="120" ry="20" fill="#E3D3B3"/>
    {dumplings}
    <circle cx="170" cy="222" r="4" fill="#E8631A"/>
    <circle cx="250" cy="216" r="4" fill="#E8631A"/>
    '''

def shake(color1, color2):
    return f'''
    <path d="M155 130 L245 130 L232 310 Q200 325 168 310 Z" fill="url(#shk)"/>
    <defs><linearGradient id="shk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{color1}"/><stop offset="100%" stop-color="{color2}"/>
    </linearGradient></defs>
    <ellipse cx="200" cy="130" rx="45" ry="13" fill="#ffffffcc"/>
    <path d="M185 90 q15 -25 30 0 l -6 40 l -18 0 Z" fill="#fff"/>
    <rect x="195" y="70" width="10" height="60" rx="4" fill="#fff" transform="rotate(10 200 100)"/>
    '''

def milk_tea(color1, color2, pearl=True):
    pearls = "".join(f'<circle cx="{175+i*12}" cy="{300-((i%2)*6)}" r="7" fill="#3B2314"/>' for i in range(6)) if pearl else ''
    return f'''
    <path d="M155 120 L245 120 L233 315 Q200 330 167 315 Z" fill="url(#mt)"/>
    <defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{color1}"/><stop offset="100%" stop-color="{color2}"/>
    </linearGradient></defs>
    <ellipse cx="200" cy="120" rx="45" ry="12" fill="#ffffffaa"/>
    <rect x="192" y="75" width="12" height="55" rx="5" fill="#fff" transform="rotate(-6 200 100)"/>
    {pearls}
    '''

def dessert(color):
    return f'''
    <path d="M160 150 L240 150 L220 300 Q200 315 180 300 Z" fill="#fff" opacity="0.9"/>
    <path d="M165 160 L235 160 L226 230 Q200 245 174 230 Z" fill="{color}"/>
    <circle cx="180" cy="150" r="14" fill="#fff"/>
    <circle cx="205" cy="140" r="16" fill="#FFD9E8"/>
    <circle cx="222" cy="152" r="12" fill="#B7E4C7"/>
    <rect x="150" y="298" width="100" height="14" rx="6" fill="#E3D3B3"/>
    '''

def fresh_shake(color1, color2, garnish):
    return shake(color1, color2) + f'<circle cx="230" cy="110" r="16" fill="{garnish}"/>'

PRODUCTS = {
    "burgers/plain-burger.svg": burger(),
    "burgers/burger-veg-or-cheese.svg": burger(cheese=True, veg=True),
    "burgers/burger-veg-cheese.svg": burger(cheese=True, veg=True),
    "burgers/burger-b1t1.svg": burger(double=True),
    "burgers/cheesy-hotdog-b1t1.svg": burger(double=True, cheese=True),

    "fries/fries-small.svg": fries(large=False),
    "fries/fries-large.svg": fries(large=True),

    "combos/fries-drinks.svg": fries(large=False) + drink_cup("#3A8DDE", "#1C5FA8"),
    "combos/siomai-drinks.svg": siomai(),
    "combos/chicken-rings-drinks.svg": drink_cup("#F4C542", "#E0A72E"),

    "drinks/blue-lemonade.svg": drink_cup("#4FC3F7", "#1976D2"),
    "drinks/pineapple.svg": drink_cup("#FFD54F", "#F9A825"),
    "drinks/chocolate.svg": drink_cup("#8D6E63", "#4E342E"),

    "siomai/siomai.svg": siomai(),

    "shakes/shake-base.svg": shake("#F8BBD0", "#EC407A"),

    "milk-tea/milk-tea-base.svg": milk_tea("#D7B899", "#8D6E63"),

    "desserts/special-halo-halo.svg": dessert("#FFD9E8"),
    "desserts/special-mais-conyelo.svg": dessert("#FFF3B0"),
    "desserts/special-saging-conyelo.svg": dessert("#FFE0B2"),

    "fresh-shakes/fresh-avocado-shake.svg": fresh_shake("#AED581", "#689F38", "#558B2F"),
    "fresh-shakes/fresh-mango-shake.svg": fresh_shake("#FFD54F", "#F9A825", "#FB8C00"),
    "fresh-shakes/fresh-dragon-fruit-shake.svg": fresh_shake("#F48FB1", "#EC407A", "#AD1457"),
}

for relpath, inner in PRODUCTS.items():
    full_path = os.path.join(BASE, relpath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(wrap(inner))

print(f"Generated {len(PRODUCTS)} product images.")
