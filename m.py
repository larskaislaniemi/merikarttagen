#!/usr/bin/python3

import mapnik
import cairo
import numpy as np
import sys
import tempfile
import simplejson
import cherrypy
import zipfile
import os

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


def getPDF(options, featurefile):
	STYLESHEET = 'map_style.xml'
	OUTDIR = '/tmp'

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

	(minx, miny, maxx, maxy) = options['extent']

	res_ref = 7.0   # res at which map was designed
	dpi_ref = 127.0 # dpi at which map was designed
       	         	# NB! res_ref / dpi_ref == "m/inch"

	##screen
	#output_type = 'png'
	#paper_size = [0.05, 0.05]
	#dpi = 127.0

	#paper
	output_type = 'pdf'
	
	if options['scale'] == "100000":
		scale = 1.0/100000.0
	elif options['scale'] == "50000":
		scale = 1.0/50000.0
	elif options['scale'] == "25000":
		scale = 1.0/25000.0
	else:
		raise Exception("no such scale")

	if output_type == 'pdf':
		dpi = dpi_ref

	map_size = np.array([maxx-minx, maxy-miny])
	map_size_on_paper = map_size * scale
	map_size_on_paper_inch = map_size_on_paper * 100.0 / 2.54
	map_px = map_size_on_paper_inch * dpi

	onePageOnly = False
	useCustomPaperSize = False
	try:
		useCustomPaperSize = options['useCustomPaperSize']
	except:
		useCustomPaperSize = False
		
	try:
		onePageOnly = options['onePageOnly']
	except:
		onePageOnly = False

	if onePageOnly:
		paper_size = map_size_on_paper
	elif useCustomPaperSize:
		paper_size = np.array(options['customPaperSize'])
	else:
		paper_size = np.array(landscapePaper(PAPERS[options['paperSize']]))


	paper_size_inch = np.array(paper_size) * 100.0 / 2.54
	paper_px = paper_size_inch * dpi

	res = map_size / map_px
	#if (res[0] != res[1]):
	#	print("*** ", map_size, map_px, res)
	#	raise Exception("resolution not homogeneous")

	scale_factor = dpi / dpi_ref

	ntile = np.ceil(map_px / paper_px)
	
	print (" *** ", paper_size, onePageOnly, scale, ntile)
	
	paper_covers_px = ntile * paper_px
	paper_covers_m  = ntile * paper_size / scale

	#print("Tiles: " + str(ntile))
	#print("Resolution: " + str(res) + " m/px")

	filenamelist = []

	for i in range(int(ntile[1])):
		for j in range(int(ntile[0])):
			tileminx = minx + float(j) * paper_covers_m[0] / ntile[0] 
			tilemaxx = minx + (float(j)+1) * paper_covers_m[0] / ntile[0]
			tileminy = miny + float(i) * paper_covers_m[1] / ntile[1]
			tilemaxy = miny + (float(i)+1) * paper_covers_m[1] / ntile[1]
			if not EXTEND_TO_FULLPAGE:
				tilemaxx = min([tilemaxx, maxx])
				tilemaxy = min([tilemaxy, maxy])

			#print (str(tileminx) + "–" + str(tilemaxx) + "  /  " + str(tileminy) + "–" + str(tilemaxy))

			pixx = (tilemaxx-tileminx)/res[0]
			pixy = (tilemaxy-tileminy)/res[1]

			m = mapnik.Map(int(pixx),int(pixy))
			mapnik.load_map(m, STYLESHEET)
			extent = mapnik.Box2d(tileminx,tileminy,tilemaxx,tilemaxy)
			m.zoom_to_box(extent)

			mark_ds = mapnik.GeoJSON(file=featurefile, layer_by_index=1)
			mark_lyr = mapnik.Layer('Markings')
			mark_lyr.srs = '+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs'
			mark_lyr.datasource = mark_ds
			mark_sty = mapnik.Style()
			mark_rul = mapnik.Rule()
			mark_line_symbolizer = mapnik.LineSymbolizer() 
			mark_line_symbolizer.stroke = mapnik.Color('rgb(100%,20%,20%)')
			mark_line_symbolizer.stroke_width = 4.0
			mark_rul.symbols.append(mark_line_symbolizer)
			mark_sty.rules.append(mark_rul)
			m.append_style('Markings style', mark_sty)
			mark_lyr.styles.append('Markings style')
			m.layers.append(mark_lyr)
		
			basefn = tempfile.NamedTemporaryFile().name

			#outfile = "{}/{}_{:04d}_{:04d}.{}".format(outdir, basefn, i, j, output_type)
			outfile = "{}.{}".format(basefn, output_type)

			filenamelist.append(outfile)

			if output_type == 'png':
				im = mapnik.Image(int(pixx), int(pixy))
				mapnik.render(m,im,scale_factor)
				im.save(outfile)
			elif output_type == 'pdf':
				mapnik.render_to_file(m, outfile)
			elif output_type == 'svg':
				mapnik.render_to_file(m, outfile)

	return(filenamelist)

class getMap(object):
	@cherrypy.expose
	def index(self):
		raise cherrypy.HTTPRedirect('/')

	def serve_complete(self):
		os.unlink(cherrypy.request.servedFileName)

	@cherrypy.expose
	@cherrypy.tools.json_in()
	def q(self):
		cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'
		cherrypy.response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
		cherrypy.response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, content-type, X-Token, x-token';

		try:
			inputjson = cherrypy.request.json
		except:
			cherrypy.response.headers['Content-Type'] = 'text/plain'
			return "OK"
			#return simplejson.dumps(dict(status = "OK"))
		#cherrypy.response.headers['Content-Type'] = 'application/octet-stream'
		#cherrypy.response.headers['Content-Type'] = 'text/plain'

		options = inputjson["mapOptions"]
		geojsonstr = inputjson["featureString"]

		geojsonfn = tempfile.NamedTemporaryFile().name
		geojsonfd = open(geojsonfn, "w")
		geojsonfd.write(geojsonstr)
		geojsonfd.close()

		outfiles = getPDF(options=options, featurefile=geojsonfn)

		os.unlink(geojsonfn)


		if len(outfiles) > 1:
			mime = "application/zip"
			tmpfn = tempfile.NamedTemporaryFile().name
			zipfilename = "{}.{}".format(tmpfn, "zip")
			zfile = zipfile.ZipFile(zipfilename, mode="w", compression=zipfile.ZIP_STORED)
			for ifile in range(len(outfiles)):
				print (ifile)
				zfile.write(outfiles[ifile], arcname="map_{}.pdf".format(ifile))

			zfile.close()

			for ifile in range(len(outfiles)):
				os.unlink(outfiles[ifile])
				
			cherrypy.request.servedFileName = zipfilename
			cherrypy.request.hooks.attach('before_finalize', self.serve_complete)
			return cherrypy.lib.static.serve_file(zipfilename, mime)
		else:
			mime = "application/pdf"
			cherrypy.request.servedFileName = outfiles[0]
			cherrypy.request.hooks.attach('before_finalize', self.serve_complete)
			return cherrypy.lib.static.serve_file(outfiles[0], mime)

def CORS():
	cherrypy.response.headers["Access-Control-Allow-Origin"] = "*"


if __name__ == "__main__":
	conf = {
		'/': {
			'tools.sessions.on': True
		}
	}

	cherrypy.config.update({
		'server.socket_host': '0.0.0.0',
		'server.socket_port': 8081,
		'tools.encode.on': True,
		'tools.encode.encoding': 'utf-8'
	})

	cherrypy.tools.CORS = cherrypy.Tool('before_handler', CORS)
	cherrypy.quickstart(getMap(), '/', conf)
