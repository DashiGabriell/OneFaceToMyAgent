import bpy
import math
import os

FBX = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\tripo_convert_6e048316-6be3-424d-8f69-3a9c0430f462.fbx"
OUT = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\rig\preview"

os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)

mesh = next(o for o in bpy.data.objects if o.type == 'MESH')

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.06, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

def add_area(name, loc, energy, size):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.size = size
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    return o

add_area("key", (-1.5, -2.0, 2.2), 500, 2.0)
add_area("fill", (2.0, -1.5, 1.2), 250, 2.5)
add_area("rim", (0.0, 2.5, 2.0), 400, 2.0)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.2
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

center = (0.0, 0.0, 0.5)

def look_at(obj, target):
    direction = (bpy.mathutils.Vector(target) - obj.location) if hasattr(bpy, 'mathutils') else None

from mathutils import Vector

def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

views = {
    "front_negY": (0.0, -3.0, 0.5),
    "front_posY": (0.0, 3.0, 0.5),
    "left_negX": (-3.0, 0.0, 0.5),
    "right_posX": (3.0, 0.0, 0.5),
    "three_quarter": (-2.0, -2.0, 1.2),
    "top": (0.0, 0.0, 3.0),
}

for name, loc in views.items():
    cam.location = loc
    aim(cam, center)
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)
