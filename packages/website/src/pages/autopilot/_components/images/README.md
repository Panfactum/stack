# Team Images

This directory should contain PNG images for each company stage:

- bootstrapped-team.png - Solo founder or small team
- seed-team.png - Growing engineering team  
- series-a-team.png - Scaling product team
- series-b-team.png - Established engineering organization
- series-c-team.png - Enterprise engineering teams

## Important
The component currently uses data URL placeholders. To use actual images:

1. Add your PNG images (400x300 recommended) to this directory
2. Uncomment the import statements in ScaleSection.tsx
3. Remove the placeholder assignments

## Creating Test Images
You can use the provided `create-placeholders.sh` script if you have ImageMagick installed to generate simple placeholder images for testing.