In depth:
 - You can spend resources to build machines, which are placed on a canvas. Machines are not unique
 - Machines can hold a limited amount of resources, specific to the machine type
 - Machines have recipies they always process, as long as they have the available resources
 - Machines can be connected and will attempt to fill their own inventory via pulling from immediately connected machines (think MC inventories/factorio inserters)

And a few core gameplay principles I'm designing around:
 - No "magic storage", all resources are to be stored in game. Like energy is stored in a battery machine. Allows for upscaling storage as needed which is a fun thing imho

 TODO
  - Include recipe info on infobox
  - Rework ghost to be a special recipe
   - recipeName ghost, calculate recipe
   - Lots of duplicated code currently