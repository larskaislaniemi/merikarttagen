#!/bin/bash

updatestring=""
for f in *.xml
do 
    ogr2ogr $updatestring -append -f SQLite meri.sqlite $f -dsco SPATIALITE=yes
    updatestring="-update"
done

sqlite3 meri.sqlite "SELECT load_extension('mod_spatialite'); CREATE VIEW v_vaylat AS SELECT *, SUBSTR(vayla_lk, 1, 3) AS vayla_lk_short FROM vaylat;"
sqlite3 meri.sqlite "SELECT load_extension('mod_spatialite'); CREATE VIEW v_syvyyspiste AS SELECT *, CAST(10*(depth-CAST(depth AS INTEGER)) AS INTEGER) AS depth_dec, CAST(depth AS INTEGER ) AS depth_int FROM syvyyspiste_p"
sqlite3 meri.sqlite "SELECT load_extension('mod_spatialite'); CREATE TABLE v_navigointilinjat AS SELECT *, ST_Length(geometry) AS length FROM navigointilinjat;"

