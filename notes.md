In depth:
 - You can spend resources to build machines, which are placed on a canvas. Machines are not unique
 - Machines can hold a limited amount of resources, specific to the machine type
 - Machines have recipies they always process, as long as they have the available resources
 - Machines can be connected and will attempt to fill their own inventory via pulling from immediately connected machines (think MC inventories/factorio inserters)

And a few core gameplay principles I'm designing around:
 - No "magic storage", all resources are to be stored in game. Like energy is stored in a battery machine. Allows for upscaling storage as needed which is a fun thing imho

 TODO
  - **Capabilities**
    - Split nodes into a basic device that does nothing
    - Add the ability to extend nodes via capabilities, in the machine json
    - Allows a lot of code optimization and some cool game design stuff
    - Capabilities:
      - Storage: Set of items it can store, items have a weight, storage capacity is based on weight not number of items, render like a pie chart
      - Processing: Basically most of the current node stuff, item -> item workload
      - Void: Garbage can node?
      - Decay: Specific items in the node decay over time, potentially turning into other items
      - Debug: ?
    - Each capability should handle it's own rendering
    - Each capability can provide an inventory, the sum of which the node uses
  - **Rendering**
   - Don't render off screen stuff
  - **Performance**
   - Change the tick system to tick as fast as possible (maybe limit to 20/s anyway) and convert all stuff to use delta time rather than engine ticks