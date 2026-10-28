import bpy
import json
import math
import os
import numpy as np

WORK = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\rig\work"
BLEND = os.path.join(WORK, "face_morphs.blend")
RIGGED = os.path.join(WORK, "face_rigged.blend")
GLB = os.path.join(WORK, "face_morphs.glb")
MANIFEST = os.path.join(WORK, "rig-manifest.json")

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
me = obj.data
print("MESH", obj.name, "verts", len(me.vertices), "polys", len(me.polygons))
print("SHAPE KEYS", [k.name for k in me.shape_keys.key_blocks])

for k in me.shape_keys.key_blocks:
    k.value = 0.0

def smoothstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

arm_data = bpy.data.armatures.new("FaceArmature")
arm = bpy.data.objects.new("FaceArmature", arm_data)
scene.collection.objects.link(arm)
arm.location = obj.location.copy()
arm.show_in_front = True

bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
root = eb.new("root")
root.head = (0.0, 0.0, 0.0)
root.tail = (0.0, 0.0, 0.06)
neck = eb.new("neck")
neck.head = (0.0, 0.0, 0.06)
neck.tail = (0.0, 0.0, 0.18)
neck.parent = root
neck.use_connect = True
head = eb.new("head")
head.head = (0.0, 0.0, 0.18)
head.tail = (0.0, 0.0, 0.75)
head.parent = neck
head.use_connect = True
bpy.ops.object.mode_set(mode='OBJECT')
print("BONES", [b.name for b in arm_data.bones])

for name in ("root", "neck", "head"):
    if name not in obj.vertex_groups:
        obj.vertex_groups.new(name=name)

vg = {name: obj.vertex_groups[name] for name in ("root", "neck", "head")}
p = np.empty(len(me.vertices) * 3, dtype=np.float32)
me.vertices.foreach_get("co", p)
p = p.reshape(-1, 3)
z = p[:, 2]
head_w = smoothstep(0.06, 0.13, z)
neck_w = 1.0 - head_w
root_w = np.zeros_like(z)
for i in range(len(me.vertices)):
    vg["root"].add([i], float(root_w[i]), 'REPLACE')
    vg["neck"].add([i], float(neck_w[i]), 'REPLACE')
    vg["head"].add([i], float(head_w[i]), 'REPLACE')
print("WEIGHTS head", float(head_w.min()), float(head_w.max()), "neck", float(neck_w.min()), float(neck_w.max()))

obj.parent = arm
obj.matrix_parent_inverse = arm.matrix_world.inverted()
mod = obj.modifiers.get("Armature") or obj.modifiers.new("Armature", 'ARMATURE')
mod.object = arm
mod.use_vertex_groups = True

for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        img.scale(1024, 1024)
        print("SCALED IMAGE", img.name, img.size[:])

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=GLB,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_morph=True,
    export_morph_normal=True,
    export_morph_tangent=False,
    export_skins=True,
    export_animations=False,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_def_bones=False,
    export_leaf_bone=False,
    export_armature_object_remove=False,
    export_extras=False,
    export_cameras=False,
    export_lights=False,
)
print("GLB", GLB, os.path.getsize(GLB))

channels = {
    "headYaw": {"kind": "boneRotation", "bone": "head", "axis": "y", "min": -8, "max": 8, "default": 0, "unit": "deg", "group": "Cabeça"},
    "headPitch": {"kind": "boneRotation", "bone": "head", "axis": "x", "min": -5, "max": 5, "default": 0, "unit": "deg", "group": "Cabeça"},
    "headRoll": {"kind": "boneRotation", "bone": "head", "axis": "z", "min": -3, "max": 3, "default": 0, "unit": "deg", "group": "Cabeça"},
    "headX": {"kind": "boneTranslation", "bone": "head", "axis": "x", "min": -20, "max": 20, "default": 0, "unit": "svg", "scale": 0.001, "group": "Cabeça"},
    "headY": {"kind": "boneTranslation", "bone": "head", "axis": "y", "min": -16, "max": 16, "default": 0, "unit": "svg", "scale": 0.001, "group": "Cabeça"},
    "browRaiseL": {"kind": "morph", "target": "browRaiseL", "min": 0, "max": 1, "default": 0, "group": "Sobrancelhas"},
    "browRaiseR": {"kind": "morph", "target": "browRaiseR", "min": 0, "max": 1, "default": 0, "group": "Sobrancelhas"},
    "browAngleL": {"kind": "morph", "target": "browAngleL", "min": -1, "max": 1, "default": 0, "group": "Sobrancelhas"},
    "browAngleR": {"kind": "morph", "target": "browAngleR", "min": -1, "max": 1, "default": 0, "group": "Sobrancelhas"},
    "eyelidOpenL": {"kind": "morph", "target": "eyelidOpenL", "min": 0, "max": 1, "default": 1, "inverse": True, "group": "Olhos"},
    "eyelidOpenR": {"kind": "morph", "target": "eyelidOpenR", "min": 0, "max": 1, "default": 1, "inverse": True, "group": "Olhos"},
    "squintL": {"kind": "morph", "target": "squintL", "min": 0, "max": 1, "default": 0, "group": "Olhos"},
    "squintR": {"kind": "morph", "target": "squintR", "min": 0, "max": 1, "default": 0, "group": "Olhos"},
    "gazeX": {"kind": "morph", "target": "gazeX", "min": -1, "max": 1, "default": 0, "group": "Olhos"},
    "gazeY": {"kind": "morph", "target": "gazeY", "min": -1, "max": 1, "default": 0, "group": "Olhos"},
    "pupilDilate": {"kind": "morph", "target": "pupilDilate", "min": 0, "max": 1, "default": 0, "group": "Olhos"},
    "noseFlare": {"kind": "morph", "target": "noseFlare", "min": 0, "max": 1, "default": 0, "group": "Nariz"},
    "cheekRaise": {"kind": "morph", "target": "cheekRaise", "min": 0, "max": 1, "default": 0, "group": "Nariz"},
    "jawOpen": {"kind": "morph", "target": "jawOpen", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "mouthWidth": {"kind": "morph", "target": "mouthWidth", "min": -1, "max": 1, "default": 0, "group": "Boca"},
    "mouthCornerL": {"kind": "morph", "target": "mouthCornerL", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "mouthCornerR": {"kind": "morph", "target": "mouthCornerR", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "lipUpperRaise": {"kind": "morph", "target": "lipUpperRaise", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "lipLowerDrop": {"kind": "morph", "target": "lipLowerDrop", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "lipPress": {"kind": "morph", "target": "lipPress", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "lipPucker": {"kind": "morph", "target": "lipPucker", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "tongueTip": {"kind": "morph", "target": "tongueTip", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "teethVisible": {"kind": "morph", "target": "teethVisible", "min": 0, "max": 1, "default": 0, "group": "Boca"},
    "breath": {"kind": "morph", "target": "breath", "min": 0, "max": 1, "default": 0, "group": "Pescoço"},
}

manifest = {
    "version": 1,
    "model": "face_morphs.glb",
    "coordinateSystem": "gltf-y-up",
    "bones": ["root", "neck", "head"],
    "morphTargets": [k.name for k in me.shape_keys.key_blocks if k.name != "Basis"],
    "channels": channels,
}
with open(MANIFEST, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print("MANIFEST", MANIFEST)

bpy.ops.wm.save_as_mainfile(filepath=RIGGED)
print("RIGGED", RIGGED)
print("DONE")
