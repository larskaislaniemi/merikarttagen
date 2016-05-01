#!/bin/bash

read bbox

while read line
do
    echo $line
    IFS=' '
    read -r -a arr <<< "$line"
    srcdb="${arr[0]}"
    layer="${arr[1]}"
    if [ "$srcdb" == "." ]
    then
        break
    fi
    curl -o ${srcdb}_${layer}.xml "https://extranet.liikennevirasto.fi/inspirepalvelu/${srcdb}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${srcdb}:${layer}&SRSNAME=EPSG:3067&BBOX=${bbox}"
done

