import bpy
import os
import json
import sys

FBX = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\tripo_convert_6e048316-6be3-424d-8f69-3a9c0430f462.fbx"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)

out = {"objects": [], "materials": [], "images": []}

for obj in bpy.data.objects:
    info = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "location": list(obj.location),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
        "dimensions": list(obj.dimensions),
        "matrix_world": [list(r) for r in obj.matrix_world],
    }
    if obj.type == 'MESH':
        me = obj.data
        info["verts"] = len(me.vertices)
        info["edges"] = len(me.edges)
        info["polys"] = len(me.polygons)
        info["materials"] = [m.name if m else None for m in me.materials]
        info["shape_keys"] = None
        if me.shape_keys:
            info["shape_keys"] = {
                "names": [kb.name for kb in me.shape_keys.key_blocks],
                "count": len(me.shape_keys.key_blocks),
            }
        info["vertex_groups"] = [g.name for g in obj.vertex_groups]
        info["modifiers"] = [{"name": m.name, "type": m.type} for m in obj.modifiers]
        info["uv_layers"] = [uv.name for uv in me.uv_layers]
        info["has_custom_normals"] = me.has_custom_normals if hasattr(me, "has_custom_normals") else None
        info["bbox_world"] = None
        try:
            import mathutils
            coords = [obj.matrix_world @ v.co for v in me.vertices]
            xs = [c.x for c in coords]
            ys = [c.y for c in coords]
            zs = [c.z for c in coords]
            info["bbox_world"] = {
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            }
        except Exception as exc:
            info["bbox_error"] = str(exc)
    if obj.type == 'ARMATURE':
        info["bones"] = [b.name for b in obj.data.bones]
    out["objects"].append(info)

for mat in bpy.data.materials:
    out["materials"].append(mat.name)

for img in bpy.data.images:
    out["images"].append({"name": img.name, "filepath": img.filepath, "size": list(img.size)})

print("=== INSPECT_JSON_BEGIN ===")
print(json.dumps(out, indent=2, default=str))
print("=== INSPECT_JSON_END ===")
