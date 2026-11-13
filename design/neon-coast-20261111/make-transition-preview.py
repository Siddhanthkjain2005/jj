"""Video slideshow of generated concepts; not real-time game footage or 3D animation."""
from pathlib import Path
import subprocess

root = Path(__file__).parent
files = ["01-home-neon.png", "02-garage-workshop.png", "03-story-world.png", "05-home-coastal-alternative.png"]
args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-filter_complex_threads", "1"]
for name in files:
    args += ["-loop", "1", "-framerate", "30", "-t", "3.2", "-i", str(root / name)]
filters = []
for i in range(len(files)):
    filters.append(f"[{i}:v]scale=1280:640:force_original_aspect_ratio=decrease,pad=1280:640:(ow-iw)/2:(oh-ih)/2:color=0x080F1B,setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v{i}]")
filters.append("[v0][v1]xfade=transition=fade:duration=0.35:offset=2.85[x1]")
filters.append("[x1][v2]xfade=transition=fade:duration=0.35:offset=5.7[x2]")
filters.append("[x2][v3]xfade=transition=fade:duration=0.35:offset=8.55[out]")
args += ["-filter_complex", ";".join(filters), "-map", "[out]", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart", str(root / "transition-preview.mp4")]
subprocess.run(args, check=True)
