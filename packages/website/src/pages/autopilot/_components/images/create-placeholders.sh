#!/bin/bash
# Create placeholder PNG images for each team stage
# These are temporary placeholders - replace with actual team illustrations

# Create 400x300 placeholder images with ImageMagick if available
if command -v convert &> /dev/null; then
    echo "Creating placeholder images with ImageMagick..."
    
    convert -size 400x300 xc:'#1a3b50' -fill '#3b81b0' -draw "circle 200,120 200,160" -draw "circle 140,140 140,175" -draw "circle 260,140 260,175" -fill '#3b81b0' -pointsize 20 -draw "text 200,220 'Bootstrapped Team'" bootstrapped-team.png
    
    convert -size 400x300 xc:'#1a3b50' -fill '#3b81b0' -draw "circle 200,120 200,160" -draw "circle 140,140 140,175" -draw "circle 260,140 260,175" -fill '#3b81b0' -pointsize 20 -draw "text 200,220 'Seed Team'" seed-team.png
    
    convert -size 400x300 xc:'#1a3b50' -fill '#3b81b0' -draw "circle 200,120 200,160" -draw "circle 140,140 140,175" -draw "circle 260,140 260,175" -fill '#3b81b0' -pointsize 20 -draw "text 200,220 'Series A Team'" series-a-team.png
    
    convert -size 400x300 xc:'#1a3b50' -fill '#3b81b0' -draw "circle 200,120 200,160" -draw "circle 140,140 140,175" -draw "circle 260,140 260,175" -fill '#3b81b0' -pointsize 20 -draw "text 200,220 'Series B Team'" series-b-team.png
    
    convert -size 400x300 xc:'#1a3b50' -fill '#3b81b0' -draw "circle 200,120 200,160" -draw "circle 140,140 140,175" -draw "circle 260,140 260,175" -fill '#3b81b0' -pointsize 20 -draw "text 200,220 'Series C+ Team'" series-c-team.png
    
    echo "Placeholder images created!"
else
    echo "ImageMagick not found. Please install ImageMagick or manually add PNG images."
    echo "Required images:"
    echo "- bootstrapped-team.png (400x300)"
    echo "- seed-team.png (400x300)"
    echo "- series-a-team.png (400x300)"
    echo "- series-b-team.png (400x300)"
    echo "- series-c-team.png (400x300)"
fi