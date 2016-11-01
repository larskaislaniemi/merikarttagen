		m = mapnik.Map(int(pixx),int(pixy))
		mapnik.load_map(m, stylesheet)
		extent = mapnik.Box2d(tileminx,tileminy,tilemaxx,tilemaxy)
		m.zoom_to_box(extent)

		mark_ds = mapnik.GeoJSON(file="test.geojson", layer_by_index=1)
		print (mark_ds.envelope())
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
		#print(m.envelope())
		
		outfile = "{}/map_{:04d}_{:04d}.{}".format(outdir, i, j, output_type)

