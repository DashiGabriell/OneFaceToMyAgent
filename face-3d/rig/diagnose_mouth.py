import bpy
import os
from mathutils import Vector

BLEND = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\rig\work\face_morphs.blend"
OUT = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\rig\work\diagnose"
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
obj = next(o for o in bpy.data.objects if o.type == 'MESH')

for name, color in (("MouthCavity", (1.0, 0.0, 0.0)), ("MouthTeeth", (0.0, 1.0, 0.0)), ("MouthTongue", (0.0, 0.0, 1.0)), ("MouthTunnel", (1.0, 1.0, 0.0))):
    mat = bpy.data.materials.get(name)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0

head_mat = obj.data.materials[0]
bsdf = head_mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (1.0, 0.0, 1.0, 1.0)
bsdf.inputs["Emission Color"].default_value = (1.0, 0.0, 1.0, 1.0)
bsdf.inputs["Emission Strength"].default_value = 1.0

keys = obj.data.shape_keys.key_blocks
keys["jawOpen"].value = 1.0

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.03, 0.03, 0.03, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

def aim(o, target):
    direction = Vector(target) - o.location
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

cam_data = bpy.data.cameras.new("cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 0.34
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for name, loc, target in (
    ("mouth_debug_front", (0.0, -2.5, 0.24), (0.0, -0.40, 0.24)),
    ("mouth_debug_side", (-1.1, -2.2, 0.31), (0.0, -0.40, 0.24)),
):
    cam.location = loc
    aim(cam, target)
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
