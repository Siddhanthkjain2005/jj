# VelocityVerse — Neon Coast UI concepts
Concept pack • 11 November 2026 • Android game UI • Generated visuals, not screenshots of implemented features.

## Direction
An original coastal motorsport world with cinematic night lighting, believable vehicle materials, rich inhabited surroundings and a restrained touch interface. Car and environment carry the spectacle; navigation stays readable.

The main direction is Neon Coast: midnight navy #080F1B, charcoal glass surfaces, warm ivory text, acid lime #DCFF52 for the primary action, pale cyan secondary detail and selective magenta environment lights. Coastal Afterglow is an alternative sunset treatment using coral, peach and violet.

All screens use the same original silver/graphite Vanta GT as a visual anchor. This is a visual concept vehicle, not a promised new asset already implemented in the app. The existing garage has multiple rides; screens must reflect actual vehicle selection in implementation.

## Screens
1. Home: a physical waterfront garage, clear Continue Story, secondary Quick Race and Free Drive, five stable destinations.
2. Garage: detailed car stage, material/paint controls, a compact ride selector and understandable performance information.
3. Story: a physical-looking Lumen Harbor map; three real route names; a single focused event sheet.
4. Event Ready: the chosen car and circuit with readable event goals, setup, assists and one race action.
5. Coastal Afterglow: alternative home art direction.
6. Motion Language: six-frame storyboard describing animation intentions. It is a static storyboard, not a video.

Text, counters, mission numbers, rewards, statistics and layout details in generated images are illustrative. The game's actual save state, event definitions, available controls and vehicle stats remain authoritative. Generated typography may contain errors; the UI text should remain editable rather than baked into artwork.

## Android interaction
Landscape composition around 20:9. Keep controls inside display-cutout and system-gesture safe areas. Touch targets at least 48 dp; image concept pixels are not dp measurements. Leave the car and track readable. Main actions remain reachable with a thumb, focused selections are clear without color alone, Android Back closes the current panel before leaving the screen, and text can scale.

Home/story/garage/world/crew labels describe the concept's navigation. Only destinations with real functionality should become interactive. Crew portraits and places are original fictional material.

## Motion treatment
| Moment | Intended motion | Timing target |
| --- | --- | --- |
| Home entry | Camera settles toward the vehicle; interface fades with at most 12 px movement; immediately skippable | 650 ms |
| Touch | Small press compression and one restrained highlight/ripple | 90 ms down, 180 ms return |
| Garage selection | Matched car framing; calm camera move; selected paint blends on the model | 300–400 ms car, 200 ms paint |
| Event selection | Route traces along the streets; one detail sheet opens | 400 ms route, 240 ms sheet |
| Start event | Lights wake, garage opens and camera resolves into racing; matches actual loading | 600–800 ms |
| Finish | Measured number reveal, stars only if earned, Continue immediately available | under 700 ms |
| Reduced motion | Short opacity changes; automatic orbit, sweeping light and parallax disabled | about 120 ms |

The storyboard illustrates these states. It does not establish actual performance, animation or 3D render quality. Interface input should remain responsive during transitions. Avoid constant glitch animation, full-screen flashes, excessive bloom and invented loading percentages.

## Practical free tools for Claude
- Blender MCP: already configured locally; car/body parts, garage environment, material studies, camera paths and exported glTF assets. Community connector: https://github.com/ahujasid/mcp-for-blender
- Penpot MCP: editable layout/components/design tokens, with official Claude connector options: https://help.penpot.app/mcp/ and https://penpot.app/ai/mcp-server
- GSAP: an animation code library suited to the present WebView/WebGL Android app, rather than an MCP connector; the project documents free commercial use: https://github.com/greensock/GSAP/blob/master/README.md
- Optional Rive CLI: interactive vector controls/badges and authored character motion; official coding-agent workflow: https://rive.app/agents . Pricing https://rive.app/pricing must be checked: free exports include a Rive splash and free publishing/collaboration is limited.
- Godot MCP: already configured locally. If a Godot project is chosen, built-in Tween and AnimationPlayer provide transitions; a UI redesign does not itself require an engine migration. https://docs.godotengine.org/en/stable/classes/class_tween.html and https://docs.godotengine.org/en/stable/classes/class_animationplayer.html

A configured connector is not proof the current Claude session loaded it; Claude Desktop may need restarting. This task does not change connector configuration or install additional tools.

## Reference research
Online image-search references were used for art-direction research. Competitor logos, characters and assets are not incorporated into the new concepts.
- Asphalt official garage/menu example: https://asphaltlegends.com/news/asphalt-legends-unite-is-coming
- NFS Unbound garage/interface portfolio, by the artist: https://prattatatat.com/need-for-speed
- Official NFS: https://www.ea.com/games/need-for-speed/need-for-speed-unbound
- Rockstar GTA VI visual references: https://www.rockstargames.com/VI
- Cyberpunk official visual references: https://www.cyberpunk.net/us/en/

The references inform car prominence, environmental richness, atmosphere and hierarchy. These concepts are aspirational visual targets, not evidence of competitor parity on Android.

## Image generation
Built-in image generation was used. Exact prompt set is in PROMPTS.md. No existing game code was changed by this concept task.


## Delivery notes
Use 04-race-preparation-v2.png as the final race-preparation reference; it aligns the header and navigation with Home. The earlier version is retained locally as a draft and excluded from the ZIP. transition-preview.mp4 is an approximately twelve-second crossfade study made from four static concept images. It demonstrates screen transitions only; the car, lights and paint effects in the storyboard are animation proposals, not working 3D footage.

Images and refinements were visually reviewed. Use the Home header/navigation as the canonical component design where the illustrative storyboard varies. Runtime typography, values, car meshes and road routes should use the actual game assets/data.
