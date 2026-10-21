# Wedding Quest — art to generate

Everything the map-enhancement PRD needs that doesn't exist yet. The batik and
kebaya outfits, the garden map, the couple and the photobox frames already
exist and are reused.

## How to use this

1. Every prompt says which **reference** to attach. The references in `art/ref/`
   are cut from the current art with the background removed. Attach them: an
   image model that can see the existing style and layout keeps them far more
   consistent than text alone.
2. Use an image model that accepts a reference image and can edit it, such as
   ChatGPT or Gemini image editing. For M2 (the bigger map), an editor with
   "generative expand" (Photoshop, Photopea) works best.
3. Save each result in `art/in/` under the exact file name in the table. The
   size doesn't have to be exact: keep the grid and the aspect ratio, and I'll
   trim, rescale, clean the background and wire it in.
4. **Background:** transparent PNG. If the tool can't do transparency, use a
   flat solid magenta `#FF00FF` background. **Never a checkerboard.** The
   current spritesheet has one painted into its pixels, which the app has to
   remove at load.
5. **Regenerate rather than patch if:** frames differ in face or height, text
   appears, pixels go soft or blurry, or a checkerboard gets painted in.
6. **Keep the magenta version; skip the tool's own "transparent" export.**
   Those cut-outs leave a magenta halo round every outline. The prep script
   keys magenta cleanly itself: `swift scripts/prep-art.swift` turns `art/in/`
   into `public/assets/`.
7. **Outfit sheets don't have to match the grid.** Models return their own
   layout (the suit came back as 10×3). The game only needs two front frames,
   two back frames, and two side frames facing the same way, ideally one
   mid-stride and one standing. I pick them by hand.

## The list

**Needed by** is the build slice that uses the asset (2 gift, 3 buffet, 4 outfits, 5 travel, 6 photobooth).
**If skipped** is what I do without it.

| ID | Asset | Save as (`art/in/`) | Target size | Attach | Needed by | If skipped |
|---|---|---|---|---|---|---|
| G1 | Gift items: envelope, gift box, bouquet | `gift_items.png` | 768×256 (3 cells) | `ref/ref_front_male.png` | 2 | Bouquet sticker + emoji |
| M1 | Map: gallery tent repainted as the buffet (prasmanan) | `map_tent_buffet.png` | 256×340 | `ref/ref_map_tent.png` | 3 | Tent keeps the photo gallery; only a PRASMANAN sign |
| B1 | Buffet ingredient and dish icons | `buffet_items.png` | 1024×1024 (4×4) | `public/assets/map/world_map_base.jpg` | 3 | Emoji |
| O1 | Outfit: black formal suit | `outfit_suit.png` | 1200×448 (8×2) | `ref/ref_outfit_male.png` | 4 | Batik body |
| O2 | Outfit: modern baju koko | `outfit_koko.png` | 1200×448 (8×2) | `ref/ref_outfit_male.png` | 4 | Batik body |
| O3 | Outfit: hijab + gamis | `outfit_hijab.png` | 1200×448 (8×2) | `ref/ref_outfit_female.png` | 4 | Kebaya body |
| O4 | Outfit: floral blouse + pleated skirt | `outfit_floral.png` | 1200×448 (8×2) | `ref/ref_outfit_female.png` | 4 | Kebaya body |
| T1 | Travel: motorcycle with rider | `travel_motor.png` | ~768×512 | `ref/ref_outfit_male.png` | 5 | Code-drawn shape |
| T2 | Travel: car | `travel_car.png` | ~768×512 | `ref/ref_outfit_male.png` | 5 | Code-drawn shape |
| T3 | Travel: 9 obstacles | `travel_obstacles.png` | 768×768 (3×3) | `ref/ref_outfit_male.png` | 5 | Code-drawn shapes |
| T4 | Travel: far background (sky, Ciremai, rice fields) | `travel_bg_far.png` | 1536×512, tileable | `public/assets/map/world_map_base.jpg` | 5 | Plain gradient sky |
| T5 | Travel: near background (village roadside + road) | `travel_bg_near.png` | 1536×512, tileable | `public/assets/map/world_map_base.jpg` | 5 | Plain road |
| T6 | Travel: janur kuning finish | `travel_finish.png` | 512×768 | `public/assets/map/world_map_base.jpg` | 5 | Code-drawn flag |
| P1 | Photobooth accessories (6) | `photo_accessories.png` | 768×512 (3×2) | `ref/ref_front_male.png` | 6 | Emoji overlays |
| P2 | Photobooth background: pelaminan with the couple | `photo_bg_pelaminan.png` | ~1200×1200 | `public/assets/characters/couple_pelaminan.jpg` | 6 | Crop of the map's pelaminan |
| P3 | Photobooth background: flower garden | `photo_bg_garden.png` | 1024×1024 | `public/assets/map/world_map_base.jpg` | 6 | Crop of the map's arch |
| P4 | Photobooth background: classic photobooth | `photo_bg_booth.png` | 1024×1024 | `public/assets/map/world_map_base.jpg` | 6 | Plain curtain drawn in code |
| X1 | *Optional:* 4 photo poses × 6 outfits | `poses_<outfit>.png` ×6 | 1200×448 (4 cells) each | A front frame of that outfit | 6 | Hand overlays + tilt |
| X2 | *Optional:* 5 milestone badges | `milestone_badges.png` | 1280×256 (5 cells) | `public/assets/map/world_map_base.jpg` | 1–6 | Emoji |
| M2 | *Optional:* bigger map, arrival area added at the bottom | `map_arrival.png` | 768×692, or the whole map at 768×1792 | `ref/ref_map_bottom.png` or the full map | 5 | Guests arrive at the flower arch, as today |
| X4 | *Optional fix:* couple portrait with real transparency | `couple_pelaminan.png` | 1200×896 | — (background remover, not generation) | — | Bride's hijab stays keyed out |

**Required: 17 images** (G1, M1, B1, O1–O4, T1–T6, P1–P4). **Optional:** X1 (6 images), X2, M2, X4.

Generate in the order of the table. The gift and buffet assets are needed first.

---

## Prompts

### G1 · Gift items

Attach `art/ref/ref_front_male.png` (for scale and style).

```
Three 16-bit pixel art item icons in one row, each centered in its own equal square cell, front view, all the same pixel scale, sized as if held in one hand by the attached character. Chunky crisp pixels, dark brown outline, warm palette, soft light from the top-left, matching the attached reference. 1: a cream wedding envelope with a gold border and a small red wax seal. 2: a small gift box wrapped in maroon paper with a gold ribbon and bow. 3: a hand-tied bouquet of white and pink flowers with a cream ribbon. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no shadow, no text, no grid lines.
```

### M1 · Buffet tent (map edit)

Attach `art/ref/ref_map_tent.png`. This is the gallery tent cut out of the map
(x 512–768, y 300–640). I paste your edit back into the same spot, so the edges
must stay identical.

```
Edit the attached image, a crop of a top-down 16-bit pixel art wedding garden map. Keep the white tent canopy, its scalloped pink trim, the tent poles, and everything outside the tent exactly as they are: same size, same position, same pixels. Change only what is under the canopy: remove the hanging photo frames, their string and the easel, and put an Indonesian wedding buffet (prasmanan) there instead: a long table with a white tablecloth and gold skirting, a row of silver chafing dishes with domed lids, a large pot of bakso soup with a little steam, a tray of sate skewers, a rice warmer, small bowls of sambal and acar, a stack of plates and a cup of spoons. Same top-down three-quarter perspective, same palette, lighting and pixel size as the rest of the image. No people, no text.
```

### B1 · Buffet icons

Attach `public/assets/map/world_map_base.jpg` (style).

```
A 4×4 grid of sixteen 16-bit pixel art food icons for an RPG inventory, each centered in its own equal square cell, seen from a three-quarter top-down angle, all the same pixel scale and lighting. Chunky crisp pixels, dark brown outline, warm palette matching the attached map. Row 1: three bakso meatballs; a bunch of green sawi (mustard greens); a ladle of clear broth; a nest of white rice vermicelli (bihun). Row 2: a nest of yellow egg noodles; four chicken sate skewers; a small dark bottle of sweet soy sauce with a plain label; a small bowl of brown peanut sauce. Row 3: a mound of white rice; a small pile of sliced red shallots; a small bowl of acar pickles (cucumber, carrot and chili); an empty white bowl. Row 4: an empty white plate; a finished bowl of bakso with meatballs, noodles, greens and broth; a finished plate of sate with peanut sauce and rice; a glass of iced sweet tea. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no text, no grid lines.
```

### O1–O4 · Outfits

Each sheet is the same 8 columns × 2 rows as the reference: the top row holds
the front and back frames, the bottom row the side walk. The frames the game
uses most are **top row: cells 1, 2, 5, 6** and **bottom row: cells 3, 4**.
Check those carefully.

**O1 · Black formal suit.** Attach `art/ref/ref_outfit_male.png`.

```
Edit the attached sprite sheet. It shows one young Indonesian man in 16 frames, 8 columns by 2 rows. Keep everything exactly the same: canvas size, grid, cell positions, every pose and walking frame, the direction each frame faces, body proportions, face, skin tone, the black peci, outline thickness and pixel size. Change only his clothes, consistently in all 16 frames including the back and side views: a black formal two-piece suit with notch lapels, a white dress shirt, a slim black necktie, black trousers and black leather shoes. 16-bit pixel art, chunky crisp pixels, no blur or smoothing. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground shadow, no text.
```

**O2 · Modern baju koko.** Attach `art/ref/ref_outfit_male.png`.

```
Edit the attached sprite sheet. It shows one young Indonesian man in 16 frames, 8 columns by 2 rows. Keep everything exactly the same: canvas size, grid, cell positions, every pose and walking frame, the direction each frame faces, body proportions, face, skin tone, the black peci, outline thickness and pixel size. Change only his clothes, consistently in all 16 frames including the back and side views: a modern baju koko, a long-sleeved tunic shirt with a short mandarin collar in sage green, with fine cream embroidery down the button placket, worn untucked to mid-thigh, with dark charcoal trousers and dark brown loafers. 16-bit pixel art, chunky crisp pixels, no blur or smoothing. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground shadow, no text.
```

**O3 · Hijab and gamis.** Attach `art/ref/ref_outfit_female.png`.

```
Edit the attached sprite sheet. It shows one young Indonesian woman in 16 frames, 8 columns by 2 rows. Keep everything exactly the same: canvas size, grid, cell positions, every pose and walking frame, the direction each frame faces, body proportions, face, skin tone, outline thickness and pixel size. Change her clothes and head covering, consistently in all 16 frames: a loose, ankle-length gamis (long modest dress) in dusty lilac with long sleeves, and a cream pashmina hijab that fully covers the hair, ears and neck and drapes over the chest and shoulders. Remove the hair bun and jasmine flowers completely: no hair is visible in any frame, and in the back views the hijab drapes down her back. Small dark flat shoes. 16-bit pixel art, chunky crisp pixels, no blur or smoothing. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground shadow, no text.
```

**O4 · Floral blouse and pleated skirt.** Attach `art/ref/ref_outfit_female.png`.
Kept long-sleeved and ankle-length because the venue is a pesantren. Loosen it if
you want.

```
Edit the attached sprite sheet. It shows one young Indonesian woman in 16 frames, 8 columns by 2 rows. Keep everything exactly the same: canvas size, grid, cell positions, every pose and walking frame, the direction each frame faces, body proportions, face, skin tone, outline thickness and pixel size. Change her clothes, consistently in all 16 frames including the back and side views: a youthful, modest outfit of a long-sleeved pastel-yellow blouse with a small pink-and-white floral print and a rounded collar, tucked into an ankle-length pleated skirt in dusty blue, with white flat shoes. Keep the hair bun, but replace the jasmine flowers with a small pastel-pink ribbon bow. 16-bit pixel art, chunky crisp pixels, no blur or smoothing. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground shadow, no text.
```

### T1–T6 · Travel minigame

The travel scene is a **side view**: everything faces right and stands on one
ground line. The walking mode uses your outfit's own walk frames, so it needs
no art.

**T1 · Motorcycle.** Attach `art/ref/ref_outfit_male.png` (pixel size and style).

```
A single 16-bit pixel art sprite matching the attached reference's pixel size and style: chunky crisp pixels, dark brown outline, warm palette. A side view of an Indonesian step-through motor scooter facing RIGHT, ridden by a person wearing a full-face helmet and a dark blue rain jacket, so the rider is anonymous. The whole vehicle is visible, both wheels on the same horizontal line at the bottom, centered with a little empty margin. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground, no shadow, no motion lines, no text.
```

**T2 · Car.** Attach `art/ref/ref_outfit_male.png`.

```
A single 16-bit pixel art sprite matching the attached reference's pixel size and style: chunky crisp pixels, dark brown outline, warm palette. A side view of a small, cute, boxy Indonesian family car in maroon red facing RIGHT, with dark tinted windows so no driver is visible. The whole car is visible, both wheels on the same horizontal line at the bottom, centered with a little empty margin. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground, no shadow, no motion lines, no text.
```

**T3 · Obstacles.** Attach `art/ref/ref_outfit_male.png`.

```
A 3×3 grid of nine 16-bit pixel art obstacles for a side-scrolling game, each centered in its own equal square cell, all seen from the SIDE, all the same pixel scale, each resting on an invisible ground line near the bottom of its cell. Chunky crisp pixels, dark brown outline, warm palette matching the attached reference. 1: a small pile of sand. 2: a yellow-and-black striped speed bump. 3: an orange traffic cone. 4: a muddy water puddle. 5: a small stack of white rice sacks. 6: a fallen green coconut. 7: a brown village chicken. 8: an orange tabby cat sitting. 9: a banana peel. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no text, no grid lines.
```

**T4 · Far background.** Attach `public/assets/map/world_map_base.jpg`.

```
A wide side-scrolling game background layer in a 3:1 landscape format, 16-bit pixel art matching the attached map's style and palette: chunky crisp pixels. The West Java countryside in warm morning light: a soft blue sky with a few pixel clouds, the volcano Mount Ciremai as a hazy blue-green silhouette, green terraced rice fields, rows of coconut palms and a few small village roofs in the distance. Flat side view, no road in this layer. It must tile seamlessly horizontally: the left and right edges match exactly. No people, no text.
```

**T5 · Near background and road.** Attach `public/assets/map/world_map_base.jpg`.

```
A wide side-scrolling game foreground layer in a 3:1 landscape format, 16-bit pixel art matching the attached map's style and palette: chunky crisp pixels. A side view of a West Java village roadside: small houses with terracotta tile roofs, a warung with a striped awning, bamboo fences, banana and coconut trees and utility poles. Across the bottom quarter runs a grey asphalt road with a white dashed center line, and the road's top edge is a perfectly straight horizontal line. Everything above the buildings and trees (the sky) is transparent; if transparency is not possible, a flat solid magenta (#FF00FF) background. It must tile seamlessly horizontally. No vehicles, no people, no text.
```

**T6 · Janur kuning finish.** Attach `public/assets/map/world_map_base.jpg`.

```
A single 16-bit pixel art sprite in a 2:3 portrait format, side-scrolling game view, matching the attached map's style and palette. An Indonesian wedding entrance marker: two tall bamboo poles with curved janur kuning (yellow young coconut-leaf decorations) arching over the top, hanging woven leaf ornaments, and potted flowers at the base of each pole, framing an open gap a traveller passes through. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no ground, no text.
```

### P1–P4 · Photobooth

The photobooth puts your character, in their outfit, in front of a background
with one accessory, then frames it with the existing batik, botanical or retro
frame. Backgrounds are **front view at eye level**, not top-down like the map.

**P1 · Accessories.** Attach `art/ref/ref_front_male.png` (scale).

```
A 3×2 grid of six 16-bit pixel art photobooth props, each centered in its own equal square cell, all in FRONT view, flat-on, at the same pixel scale as the attached character, sized as if he were wearing or holding them. Chunky crisp pixels, dark brown outline, warm palette. 1: heart-shaped red sunglasses. 2: a flower crown of small pink, white and yellow flowers. 3: a curly black fake moustache. 4: a red bow tie. 5: a small hand-held bouquet of white and pink flowers. 6: a blank cream rectangular sign mounted on a wooden stick, with nothing written on it. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no text.
```

The sign is left blank on purpose. I write "CIEE" on it in the game's pixel font,
because image models misspell text.

**P2 · Pelaminan with the couple.** Attach `public/assets/characters/couple_pelaminan.jpg`.

```
Edit the attached pixel art image. Keep the bride, the groom, the sofa, the carpet and the carved wooden backdrop exactly as they are, with the same pixels and size. Replace the grey-and-white checkerboard with a complete scene and widen the canvas to a 1:1 square: a Javanese wedding stage (pelaminan) where the carved wooden backdrop continues to both sides, tall floral arrangements and standing brass lamps at each end, a deep red carpeted floor, and clear empty floor space to the LEFT and RIGHT of the sofa where a guest could stand for a photo. Front view at eye level. 16-bit pixel art in the same style and pixel size. No new people, no text.
```

**P3 · Flower garden.** Attach `public/assets/map/world_map_base.jpg`.

```
A photobooth background in a 1:1 square format, front view at eye level, 16-bit pixel art matching the attached map's style and palette: chunky crisp pixels. A wedding flower garden: a rainbow flower arch like the one in the map (red, yellow, purple, blue and white flowers) in the middle distance, a green lawn, flower beds, two leafy trees at the sides, a soft blue morning sky and a few warm fairy lights. Keep the lower center of the foreground clear and empty, where a character will stand. No people, no text.
```

**P4 · Classic photobooth.** Attach `public/assets/map/world_map_base.jpg`.

```
A photobooth backdrop in a 1:1 square format, front view at eye level, 16-bit pixel art matching the attached map's style and palette: chunky crisp pixels. A deep maroon velvet curtain backdrop with gold tie-backs, a string of warm fairy lights and a gold star garland across the top, and a wooden floor with a small cream rug in the center. Keep the lower center clear and empty, where a character will stand. No people, no text.
```

### Optional

**X1 · Photo poses (one sheet per outfit).** For batik attach
`art/ref/ref_front_male.png`; for kebaya `art/ref/ref_front_female.png`. For the
four new outfits, I'll cut a front frame from your sheet once it lands.

```
Using the attached pixel art character, draw the SAME character, with the identical face, outfit, colors, proportions, outline and pixel size, in four front-facing full-body poses in a row of four equal cells, all with their feet on the same baseline. 1: formal, standing straight with hands clasped in front. 2: a peace sign, one hand raised beside the face making a V sign, smiling. 3: a finger heart, both hands in front of the chest making a Korean finger heart. 4: funny, leaning sideways with one leg kicked up, arms out and a big grin. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no text.
```

**X2 · Milestone badges.** Attach `public/assets/map/world_map_base.jpg`.
In order: Welcome Guest, First Greeting, Foodie Moment, Picture Perfect, Wedding All-Star.

```
Five 16-bit pixel art achievement badges in one row, each a round gold medallion with a dark wood rim, centered in its own equal square cell, all the same size. Chunky crisp pixels, warm palette matching the attached map. The icon inside each: 1 a flower arch gate, 2 two hands shaking, 3 a steaming bowl of meatball soup, 4 a vintage camera, 5 a big gold star with a red ribbon. Transparent background; if transparency is not possible, a flat solid magenta (#FF00FF) background. No checkerboard pattern, no text.
```

**M2 · Bigger map: an arrival area below the arch.** The map grows from
768×1376 to 768×1792, downward only. Every existing landmark and coordinate
stays valid; I re-measure only the bottom wall and the spawn point. This gives
the travel minigame somewhere to arrive: you park, then walk in through the arch.
It costs about 150–200 KB of extra download.

- **With generative expand (best):** open `public/assets/map/world_map_base.jpg`,
  extend the canvas **downward by 416 px**, select the new empty area, and fill it with the prompt.
  Save the whole map as `map_arrival.png`.
- **With an image model:** attach `art/ref/ref_map_bottom.png` (the bottom 276 px
  of the map) and ask it to continue the image downward by 416 px, keeping the
  attached strip unchanged at the top. Expect to retry a few times to get a clean seam.

```
Top-down 16-bit pixel art in three-quarter view, matching the attached wedding garden map's style, palette, lighting and pixel size exactly. Continue the garden below the existing bottom edge as the guests' arrival area: the grey stone path continues straight down from the flower arch to a small paved drop-off and parking area, with three parked motor scooters in a neat row on the left and one small car on the right, all seen from above. Two tall janur kuning decorations (curved yellow young coconut-leaf ornaments on bamboo poles) flank the path at the very bottom entrance, with a blank wooden welcome-sign easel beside the path. Add grass, flower beds and two trees matching the existing ones, and a strip of grey asphalt village road along the very bottom edge. The new area joins the existing image seamlessly, with no visible seam. No people, no text.
```

I don't recommend regenerating the whole map. The couple are painted into it,
every landmark and wall would need re-measuring, and the style would drift.

**X4 · Couple portrait with real transparency.** This isn't generation. Run
`public/assets/characters/couple_pelaminan.jpg` through a background remover
(Photoshop's Remove Background, remove.bg). Check that the bride's white hijab
and veil survive, then save the result as `couple_pelaminan.png`. The app's
automatic background removal strips the hijab and veil because they touch the
checkerboard, so the bride's hijab shows the panel colour behind her in the
Pasangan and Ngobrol screens.

---

## Round 2 · Salaman and the photo with the couple

| ID | Asset | Save as (`art/in/`) | Attach |
|---|---|---|---|
| C1 | The couple as standing chibi characters, 4 poses | `couple_stand.png` | `art/ref/ref_front_male.png`, `art/ref/ref_front_female.png`, `public/assets/characters/couple_pelaminan.jpg` |
| C2 | Three gesture icons: handshake, salam, doa | `salaman_icons.png` | `art/ref/ref_front_male.png` |

**C1 · Couple, standing.** Attach all three: the two guest characters set the style and size, the portrait sets their faces and clothes.

```
Draw the bride and groom from the attached wedding portrait as small full-body 16-bit pixel art characters in exactly the same chibi style, proportions, outline and pixel size as the two attached guest characters. Same faces as the portrait. The groom wears a white kopiah, a black suit jacket with a small flower on the lapel, a white shirt and a brown batik sarong over black trousers. The bride wears a long white gown, a white hijab with a small silver tiara, and a sheer white veil. Arrange them in a grid of 4 rows and 2 columns with clear empty space between every figure: the groom in the left column, the bride in the right column, both always facing the viewer, full body, feet on the same baseline in each row. Row 1: standing, smiling, hands relaxed, the bride holding a small white bouquet. Row 2: each making a peace sign beside the face. Row 3: each making a finger heart in front of the chest. Row 4: each waving happily with one hand raised. Flat solid magenta (#FF00FF) background, no checkerboard, no shadows, no text.
```

**C2 · Gesture icons.** Attach `art/ref/ref_front_male.png` (style).

```
Three 16-bit pixel art icons in one row, each centred in its own equal square cell, chunky crisp pixels, dark brown outline, warm palette, matching the attached character's style. 1: two hands in a warm handshake, one sleeve a black suit jacket, the other a plain sleeve. 2: a right hand placed flat on the chest over the heart, the polite Indonesian salam that does not touch. 3: two open palms raised together in prayer (berdoa). Flat solid magenta (#FF00FF) background, no checkerboard, no text.
```
