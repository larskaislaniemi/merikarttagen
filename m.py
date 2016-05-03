#!/usr/bin/python3

import mapnik
import cairo
import numpy as np
import sys

def rotatePaper(size):
	newsize = [0,0]
	newsize[0] = size[1]
	newsize[1] = size[0]
	return newsize

def landscapePaper(size):
	if size[0] < size[1]:
		newsize = rotatePaper(size)
		return newsize
	else:
		return size

EXTEND_TO_FULLPAGE = True

PAPERS = {
	'A4': [0.210, 0.297],
	'A3': [0.297, 0.420],
	'A2': [0.420, 0.594],
	'A1': [0.594, 0.841],
	'A0': [0.841, 1.189]
}

AREAS = {
	'Hki-Por': [378611, 6650868, 431027, 6696444]
}

if len(sys.argv) <= 1:
	raise Exception("Parameter missing: map stylesheet file")

stylesheet = sys.argv[1]

if len(sys.argv) == 3:
	outdir = sys.argv[2]
else:
	outdir = "outdata"

(minx, miny, maxx, maxy) = AREAS['Hki-Por']

res_ref = 7.0   # res at which map was designed
dpi_ref = 127.0 # dpi at which map was designed
                # NB! res_ref / dpi_ref == "m/inch"

#output_type = 'png'
#paper_size = [0.05, 0.05]
#dpi = 127.0

#output_type = 'png'
#paper_size = [0.518, 0.324] # x, y (m)
#dpi = 94
#dpi = dpi * 4.0

output_type = 'pdf'
paper_size = landscapePaper(PAPERS['A3'])

#output_type = 'png'
#paper_size = landscapePaper(PAPERS['A3'])
#dpi = 300.0

scale = 1.0/50000.0


###############################################################################


if output_type == 'pdf':
	dpi = dpi_ref

paper_size_inch = np.array(paper_size) * 100.0 / 2.54
paper_px = paper_size_inch * dpi

map_size = np.array([maxx-minx, maxy-miny])
map_size_on_paper = map_size * scale
map_size_on_paper_inch = map_size_on_paper * 100.0 / 2.54
map_px = map_size_on_paper_inch * dpi

res = map_size / map_px
if (res[0] != res[1]):
	raise Exception("resolution not homogeneous")

scale_factor = dpi / dpi_ref

ntile = np.ceil(map_px / paper_px)
paper_covers_px = ntile * paper_px
paper_covers_m  = ntile * paper_size / scale

print("Tiles: " + str(ntile))
print("Resolution: " + str(res) + " m/px")

for i in range(int(ntile[1])):
	for j in range(int(ntile[0])):

		tileminx = minx + float(j) * paper_covers_m[0] / ntile[0] 
		tilemaxx = minx + (float(j)+1) * paper_covers_m[0] / ntile[0]
		tileminy = miny + float(i) * paper_covers_m[1] / ntile[1]
		tilemaxy = miny + (float(i)+1) * paper_covers_m[1] / ntile[1]
		if not EXTEND_TO_FULLPAGE:
			tilemaxx = min([tilemaxx, maxx])
			tilemaxy = min([tilemaxy, maxy])

		print (str(tileminx) + "–" + str(tilemaxx) + "  /  " + str(tileminy) + "–" + str(tilemaxy))

		pixx = (tilemaxx-tileminx)/res[0]
		pixy = (tilemaxy-tileminy)/res[1]

		m = mapnik.Map(int(pixx),int(pixy))
		mapnik.load_map(m, stylesheet)
		extent = mapnik.Box2d(tileminx,tileminy,tilemaxx,tilemaxy)
		m.zoom_to_box(extent)
		#print(m.envelope())

		outfile = "{}/map_{:04d}_{:04d}.{}".format(outdir, i, j, output_type)

		if output_type == 'png':
			im = mapnik.Image(int(pixx), int(pixy))
			mapnik.render(m,im,scale_factor)
			im.save(outfile)
		elif output_type == 'pdf':
			mapnik.render_to_file(m, outfile)
		elif output_type == 'svg':
			mapnik.render_to_file(m, outfile)

