import bpy
import bmesh
import os
import sys
import json
import numpy as np
from mathutils import Vector

FBX = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\tripo_convert_6e048316-6be3-424d-8f69-3a9c0430f462.fbx"
TEX = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\tripo_convert_6e048316-6be3-424d-8f69-3a9c0430f462.fbm\head_with_cap_3d_model_basecolor.JPEG"
WORK = r"C:\Users\Gabriell\Projetos\rosto-svg\face-3d\rig\work"
PREV = os.path.join(WORK, "previews")
os.makedirs(PREV, exist_ok=True)

RATIO = 0.08

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

me = obj.data
for mat in me.materials:
    if mat is not None:
        mat.use_backface_culling = True
n = len(me.vertices)
p = np.empty(n * 3, dtype=np.float32)
me.vertices.foreach_get('co', p)
p = p.reshape(-1, 3).astype(np.float64)

def ellipsoid(center, radii, power=1.0):
    c = np.array(center, dtype=np.float64)
    r = np.array(radii, dtype=np.float64)
    d = (p - c) / r
    v = np.clip(1.0 - (d * d).sum(axis=1), 0.0, 1.0)
    return v ** power

def smoothstep(a, b, x):
    if a == b:
        return (x >= a).astype(np.float64)
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def side_mask(sign, width=0.03):
    return smoothstep(-width, width, p[:, 0] * sign)

# ---------- decimation ----------
protect = np.zeros(n, dtype=np.float64)
protect = np.maximum(protect, ellipsoid((0.0, -0.410, 0.250), (0.150, 0.070, 0.060)))
protect = np.maximum(protect, ellipsoid((-0.124, -0.310, 0.497), (0.060, 0.045, 0.038)))
protect = np.maximum(protect, ellipsoid((0.124, -0.310, 0.497), (0.060, 0.045, 0.038)))
protect = np.maximum(protect, ellipsoid((0.0, -0.465, 0.360), (0.065, 0.050, 0.045)))
protect = np.maximum(protect, ellipsoid((-0.150, -0.320, 0.580), (0.120, 0.045, 0.040)))
protect = np.maximum(protect, ellipsoid((0.150, -0.320, 0.580), (0.120, 0.045, 0.040)))
protect = np.maximum(protect, ellipsoid((0.0, -0.380, 0.460), (0.300, 0.060, 0.120)))
protect = protect ** 0.6

vg = obj.vertex_groups.new(name="protect")
for i in np.where(protect > 0.001)[0]:
    vg.add([int(i)], float(protect[i]), 'REPLACE')

mod = obj.modifiers.new("Decimate", 'DECIMATE')
mod.decimate_type = 'COLLAPSE'
mod.ratio = RATIO
mod.use_collapse_triangulate = True
mod.vertex_group = "protect"
mod.vertex_group_factor = 1.0
mod.invert_vertex_group = True
bpy.ops.object.modifier_apply(modifier=mod.name)
obj.vertex_groups.remove(obj.vertex_groups["protect"])

if me.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
for poly in me.polygons:
    poly.use_smooth = True
me.update()

n = len(me.vertices)
p = np.empty(n * 3, dtype=np.float32)
me.vertices.foreach_get('co', p)
p = p.reshape(-1, 3).astype(np.float64)
x, y, z = p[:, 0], p[:, 1], p[:, 2]
print("DECIMATED verts", n, "tris", len(me.polygons))

mouth_y_fit = None
bm = bmesh.new()
bm.from_mesh(me)
seam_faces = []
for f in bm.faces:
    c = f.calc_center_median()
    if ((c.x / 0.100) ** 2 + ((c.z - 0.250) / 0.024) ** 2) < 1.0 and c.y < -0.395:
        seam_faces.append(f)
print("MOUTH SEAM FACES", len(seam_faces))
bmesh.ops.delete(bm, geom=seam_faces, context='FACES')

bm.verts.ensure_lookup_table()
bm.edges.ensure_lookup_table()
boundary_edges = [
    e for e in bm.edges
    if e.is_boundary
    and abs(e.verts[0].co.z - 0.250) < 0.050
    and abs(e.verts[1].co.z - 0.250) < 0.050
    and abs(e.verts[0].co.x) < 0.135
    and abs(e.verts[1].co.x) < 0.135
    and e.verts[0].co.y < -0.385
    and e.verts[1].co.y < -0.385
]
adj = {}
for e in boundary_edges:
    a, b2 = e.verts
    adj.setdefault(a, set()).add(b2)
    adj.setdefault(b2, set()).add(a)
seen = set()
components = []
for v in adj:
    if v in seen:
        continue
    stack = [v]
    comp = []
    seen.add(v)
    while stack:
        cur = stack.pop()
        comp.append(cur)
        for nxt in adj[cur]:
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    components.append(comp)
print("MOUTH BOUNDARY LOOPS", len(components), "verts", [len(c) for c in components])
if components:
    loop = max(components, key=len)
    a_rad = 0.098
    b_rad = 0.022
    for v in loop:
        ang = np.arctan2((v.co.z - 0.250) / b_rad, v.co.x / a_rad)
        v.co.x = a_rad * np.cos(ang)
        v.co.z = 0.250 + b_rad * np.sin(ang)
    lx = np.array([v.co.x for v in loop], dtype=np.float64)
    ly = np.array([v.co.y for v in loop], dtype=np.float64)
    mouth_y_fit = np.polyfit(lx * lx, ly, 1)
    print("MOUTH Y FIT", mouth_y_fit)

bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(me)
bm.free()
me.update()

head_vg = obj.vertex_groups.new(name="part_head")
head_vg.add(list(range(n)), 1.0, 'REPLACE')

uv_name = me.uv_layers.active.name
nl = len(me.loops)
head_uvs = np.empty(nl * 2, dtype=np.float32)
me.uv_layers.active.data.foreach_get('uv', head_uvs)
head_uvs = head_uvs.reshape(nl, 2)
lv = np.empty(nl, dtype=np.int32)
me.loops.foreach_get('vertex_index', lv)
first_loop = np.full(n, -1, dtype=np.int32)
order = np.argsort(lv, kind='stable')
lv_sorted = lv[order]
uniq_first = np.concatenate(([True], lv_sorted[1:] != lv_sorted[:-1]))
first_loop[lv_sorted[uniq_first]] = order[uniq_first]
head_uv = head_uvs[first_loop]

from mathutils.kdtree import KDTree
kd = KDTree(n)
for i in range(n):
    kd.insert(Vector(p[i]), i)
kd.balance()

# ---------- mouth interior ----------
def make_material(name, color, roughness=0.8, metallic=0.0, specular=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    if hasattr(mat, "use_backface_culling"):
        mat.use_backface_culling = False
    return mat

def set_group(o, name):
    vg = o.vertex_groups.new(name=name)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')

def add_part_sphere(name, loc, scale, mat, group, cut_y=None, rim=None, flip=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if cut_y is not None:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        faces = [f for f in bm.faces if f.calc_center_median().y < cut_y]
        bmesh.ops.delete(bm, geom=faces, context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
        if rim is not None:
            boundary = [e for e in bm.edges if e.is_boundary]
            adj = {}
            for e in boundary:
                a, b2 = e.verts
                adj.setdefault(a, set()).add(b2)
                adj.setdefault(b2, set()).add(a)
            seen = set()
            comps = []
            for v in adj:
                if v in seen:
                    continue
                stack = [v]
                comp = []
                seen.add(v)
                while stack:
                    cur = stack.pop()
                    comp.append(cur)
                    for nxt in adj[cur]:
                        if nxt not in seen:
                            seen.add(nxt)
                            stack.append(nxt)
                comps.append(comp)
            if comps:
                loop = max(comps, key=len)
                zc, a_rad, b_rad, y_plane = rim
                for v in loop:
                    ang = np.arctan2((v.co.z - zc) / b_rad, v.co.x / a_rad)
                    v.co.x = a_rad * np.cos(ang)
                    v.co.z = zc + b_rad * np.sin(ang)
                    v.co.y = y_plane
        if flip:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        else:
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.append(mat)
    set_group(o, group)
    return o

def add_teeth(name, z, group, mat):
    objs = []
    xs = (-0.048, -0.024, 0.0, 0.024, 0.048)
    for i, tx in enumerate(xs):
        ty = -0.428 + 0.014 * (tx / 0.054) ** 2
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(tx, ty, z))
        o = bpy.context.object
        o.name = f"{name}_{i}"
        o.scale = (0.012, 0.004, 0.007)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        mod = o.modifiers.new("Bevel", 'BEVEL')
        mod.width = 0.0015
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        o.data.materials.append(mat)
        set_group(o, group)
        objs.append(o)
    for o in bpy.data.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined

def add_mouth_tunnel(mat_head, mat_wall, group, y_fit, head_p, head_uv, kd, uv_name):
    nseg = 48
    zc = 0.250
    front_a, front_b = 0.104, 0.028
    inner_a, inner_b = 0.076, 0.003
    bm = bmesh.new()
    vf, vi = [], []
    _, lip_idx, _ = kd.find(Vector((0.0, -0.435, 0.25)))
    lip_uv = head_uv[lip_idx]
    uv_by_vert = {}

    def vertex(co):
        v = bm.verts.new(co)
        uv_by_vert[v] = lip_uv
        return v

    for i in range(nseg):
        ang = 2.0 * np.pi * i / nseg
        fx = front_a * np.cos(ang)
        fz = zc + front_b * np.sin(ang)
        near = (
            (np.abs(head_p[:, 0] - fx) < 0.022)
            & (np.abs(head_p[:, 2] - fz) < 0.022)
            & (head_p[:, 1] < -0.36)
            & (head_p[:, 1] > -0.50)
        )
        if near.any():
            fy = float(head_p[near, 1].min()) - 0.004
        elif y_fit is not None:
            fy = y_fit[0] * fx * fx + y_fit[1] - 0.0025
        else:
            fy = -0.428 + 0.042 * (fx / front_a) ** 2
        vf.append(vertex((fx, fy, fz)))
        ix = inner_a * np.cos(ang)
        iz = zc + inner_b * np.sin(ang)
        near_i = (
            (np.abs(head_p[:, 0] - ix) < 0.022)
            & (np.abs(head_p[:, 2] - iz) < 0.022)
            & (head_p[:, 1] < -0.36)
            & (head_p[:, 1] > -0.50)
        )
        if near_i.any():
            iy = float(head_p[near_i, 1].min()) - 0.004
        else:
            iy = fy + 0.001
        vi.append(vertex((ix, iy, iz)))
    for i in range(nseg):
        j = (i + 1) % nseg
        bm.faces.new((vf[i], vf[j], vi[j], vi[i]))
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.new(uv_name)
    for face in bm.faces:
        for loop in face.loops:
            loop[uv_layer].uv = uv_by_vert[loop.vert]
    mesh = bpy.data.meshes.new("MouthTunnel")
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new("MouthTunnel", mesh)
    bpy.context.scene.collection.objects.link(o)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(mat_head)
    set_group(o, group)
    set_group(o, "part_head")
    return o

mat_cavity = make_material("MouthCavity", (0.075, 0.010, 0.014), 0.95, specular=0.0)
mat_teeth = make_material("MouthTeeth", (0.66, 0.60, 0.46), 0.55, specular=0.20)
mat_tongue = make_material("MouthTongue", (0.42, 0.045, 0.060), 0.65, specular=0.25)
mat_tunnel = make_material("MouthTunnel", (0.16, 0.022, 0.032), 0.90, specular=0.05)
mat_lip = obj.data.materials[0]

cavity = add_part_sphere(
    "MouthCavity", (0.0, -0.340, 0.250), (0.105, 0.070, 0.060),
    mat_cavity, "part_cavity", cut_y=-0.385,
    rim=(0.250, 0.080, 0.042, -0.385), flip=True,
)
teeth_upper = add_teeth("TeethUpper", 0.256, "part_teeth_upper", mat_teeth)
teeth_lower = add_teeth("TeethLower", 0.242, "part_teeth_lower", mat_teeth)
tongue = add_part_sphere(
    "Tongue", (0.0, -0.396, 0.220), (0.050, 0.012, 0.020),
    mat_tongue, "part_tongue",
)
tunnel = add_mouth_tunnel(mat_lip, mat_tunnel, "part_tunnel", mouth_y_fit, p, head_uv, kd, uv_name)

parts = [cavity, teeth_upper, teeth_lower, tongue, tunnel]
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()
obj = bpy.context.object
me = obj.data

n = len(me.vertices)
p = np.empty(n * 3, dtype=np.float32)
me.vertices.foreach_get('co', p)
p = p.reshape(-1, 3).astype(np.float64)
x, y, z = p[:, 0], p[:, 1], p[:, 2]
print("JOINED verts", n, "tris", len(me.polygons))

def vgroup_mask(name):
    gi = obj.vertex_groups[name].index
    w = np.zeros(n, dtype=np.float64)
    for v in me.vertices:
        for g in v.groups:
            if g.group == gi:
                w[v.index] = g.weight
                break
    return w

head = vgroup_mask("part_head") > 0.5
cavity_m = vgroup_mask("part_cavity") > 0.5
teeth_u_m = vgroup_mask("part_teeth_upper") > 0.5
teeth_l_m = vgroup_mask("part_teeth_lower") > 0.5
tongue_m = vgroup_mask("part_tongue") > 0.5
tunnel_m = vgroup_mask("part_tunnel") > 0.5
tunnel_inner = tunnel_m & (np.abs(z - 0.250) < 0.006)

# ---------- texture classification ----------
img = bpy.data.images.load(TEX)
img.colorspace_settings.name = 'sRGB'
W, H = img.size
px = np.empty(W * H * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)

nl = len(me.loops)
uvs = np.empty(nl * 2, dtype=np.float32)
me.uv_layers.active.data.foreach_get('uv', uvs)
uvs = uvs.reshape(nl, 2)
lv = np.empty(nl, dtype=np.int32)
me.loops.foreach_get('vertex_index', lv)
first_loop = np.full(n, -1, dtype=np.int32)
order = np.argsort(lv, kind='stable')
lv_sorted = lv[order]
uniq_first = np.concatenate(([True], lv_sorted[1:] != lv_sorted[:-1]))
first_loop[lv_sorted[uniq_first]] = order[uniq_first]
vu = uvs[first_loop]
vx = np.clip((vu[:, 0] % 1.0) * (W - 1), 0, W - 1).astype(np.int32)
vy = np.clip((vu[:, 1] % 1.0) * (H - 1), 0, H - 1).astype(np.int32)
vc = px[vy, vx, :3].astype(np.float64)
r, g, b = vc[:, 0], vc[:, 1], vc[:, 2]
mx = vc.max(axis=1)
mn = vc.min(axis=1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
br = b / np.maximum(r, 1e-6)

cls = np.full(n, 0, dtype=np.int8)
cls[(r > 0.55) & (g > 0.5) & (b > 0.38) & (br > 0.68) & (sat < 0.38)] = 1
cls[(r > 0.55) & (g > 0.38) & (b < 0.30) & (br < 0.62)] = 2
cls[(r > 0.75) & (g > 0.45) & (b < 0.12)] = 3
cls[(r < 0.32) & (g < 0.25) & (b < 0.22)] = 4
cls[(b > 0.30) & (r > 0.55) & (cls == 0)] = 5
counts = {name: int(((cls == i) & head).sum()) for i, name in enumerate(["skin", "sclera", "gold", "cap", "hair", "highlight"])}
print("CLASSES", counts)

rigid = ((cls == 2) | (cls == 3) | ((cls == 5) & (z > 0.40) & (y < -0.33) & (np.abs(x) < 0.30))) & head
face = (~rigid) & head & (y < -0.18) & (z > 0.06) & (z < 0.65)
skin = (cls == 0) & head
hair = (cls == 4) & head

EYE_L = np.array([-0.124, -0.304, 0.497])
EYE_R = np.array([0.124, -0.304, 0.497])
MOUTH = np.array([0.0, -0.410, 0.250])

def eye_iris_w(sign):
    e = EYE_L if sign < 0 else EYE_R
    w = ellipsoid((e[0], e[1], e[2] - 0.003), (0.032, 0.05, 0.023), 0.8)
    w *= (cls == 4)
    w *= smoothstep(-0.345, -0.325, y)
    return w * head * (~rigid)

def eye_open_w(sign):
    e = EYE_L if sign < 0 else EYE_R
    w = ellipsoid((e[0], e[1], e[2]), (0.052, 0.06, 0.030), 0.8)
    w *= smoothstep(-0.345, -0.325, y)
    return w * ((cls == 1) | (cls == 4)) * head * (~rigid)

def upper_lid_w(sign):
    e = EYE_L if sign < 0 else EYE_R
    d = ((x - e[0]) / 0.080) ** 2 + ((z - 0.527) / 0.024) ** 2
    w = np.exp(-d)
    w *= skin & (~rigid) & (y > -0.39) & (y < -0.23)
    return w

def upper_lash_w(sign):
    e = EYE_L if sign < 0 else EYE_R
    d = ((x - e[0]) / 0.072) ** 2 + ((z - 0.508) / 0.0085) ** 2
    w = np.exp(-d)
    w *= (cls == 4) & head & (~rigid) & (y > -0.35)
    return w

def lower_lid_w(sign):
    e = EYE_L if sign < 0 else EYE_R
    d = ((x - e[0]) / 0.072) ** 2 + ((z - 0.472) / 0.017) ** 2
    w = np.exp(-d)
    w *= skin & (~rigid) & (y > -0.39) & (y < -0.23)
    return w

def eye_delta(sign, dx=0.0, dz=0.0, dy=0.0):
    e = EYE_L if sign < 0 else EYE_R
    w = eye_open_w(sign)
    d = np.zeros_like(p)
    d[:, 0] = dx * w
    d[:, 1] = dy * w
    d[:, 2] = dz * w
    return d

def brow_w(sign):
    w = ellipsoid((0.150 * sign, -0.315, 0.578), (0.125, 0.060, 0.045), 0.9)
    w *= face * side_mask(sign)
    return w

def mouth_w():
    return ellipsoid((0.0, -0.415, 0.250), (0.145, 0.060, 0.050), 0.9) * face

def upper_lip_w():
    return ellipsoid((0.0, -0.423, 0.272), (0.108, 0.040, 0.022), 0.9) * face

def lower_lip_w():
    return ellipsoid((0.0, -0.423, 0.228), (0.108, 0.040, 0.022), 0.9) * face

def seam_w():
    return ellipsoid((0.0, -0.430, 0.252), (0.112, 0.026, 0.016), 0.75) * face

def corner_w(sign):
    return ellipsoid((0.104 * sign, -0.397, 0.250), (0.045, 0.048, 0.032), 0.9) * face

def nostril_w(sign):
    return ellipsoid((0.033 * sign, -0.452, 0.358), (0.030, 0.040, 0.025), 0.9) * face

def nose_base_w():
    return ellipsoid((0.0, -0.470, 0.360), (0.052, 0.045, 0.030), 0.9) * face

def cheek_w(sign):
    return ellipsoid((0.198 * sign, -0.352, 0.375), (0.075, 0.070, 0.060), 0.9) * face

def jaw_w():
    chin = ellipsoid((0.0, -0.398, 0.150), (0.185, 0.085, 0.105), 0.9)
    lower_lip = ellipsoid((0.0, -0.421, 0.226), (0.118, 0.046, 0.034), 0.9)
    sides = ellipsoid((0.0, -0.300, 0.275), (0.250, 0.095, 0.070), 0.9)
    under = 1.0 - smoothstep(0.255, 0.305, z)
    w = np.maximum(chin, lower_lip) + 0.45 * sides * under
    w *= 1.0 - 0.90 * upper_lip_w()
    return np.clip(w, 0.0, 1.0) * face

def rotate_x(angle, origin):
    ca, sa = np.cos(angle), np.sin(angle)
    q = p - np.array(origin)
    out = q.copy()
    out[:, 1] = q[:, 1] * ca - q[:, 2] * sa
    out[:, 2] = q[:, 1] * sa + q[:, 2] * ca
    return out + np.array(origin)

def rotate_y(angle, origin):
    ca, sa = np.cos(angle), np.sin(angle)
    q = p - np.array(origin)
    out = q.copy()
    out[:, 0] = q[:, 0] * ca + q[:, 2] * sa
    out[:, 2] = -q[:, 0] * sa + q[:, 2] * ca
    return out + np.array(origin)

def zero():
    return np.zeros_like(p)

def morph(name, delta, slider=(0.0, 1.0)):
    key = obj.shape_key_add(name=name, from_mix=False)
    key.slider_min = slider[0]
    key.slider_max = slider[1]
    arr = (p + delta).astype(np.float32).ravel()
    key.data.foreach_set('co', arr)
    return key

# ---------- morph definitions ----------
morphs = {}
obj.shape_key_add(name="Basis", from_mix=False)

# brows
for sign, side in ((-1, "L"), (1, "R")):
    w = brow_w(sign)
    d = zero(); d[:, 2] = 0.010 * w
    morphs[f"browRaise{side}"] = d
    theta = sign * 0.14
    rot = rotate_y(theta, (0.150 * sign, -0.315, 0.578))
    d = (rot - p) * w[:, None]
    morphs[f"browAngle{side}"] = d

# eyelids (shape key = closed)
for sign, side in ((-1, "L"), (1, "R")):
    d = zero()
    wu = upper_lid_w(sign)
    wl = upper_lash_w(sign)
    wlo = lower_lid_w(sign)
    d[:, 2] += -0.060 * wu - 0.050 * wl + 0.010 * wlo
    d[:, 1] += -0.016 * wu - 0.012 * wl
    morphs[f"eyelidOpen{side}"] = d

# squint
for sign, side in ((-1, "L"), (1, "R")):
    d = zero()
    wu = upper_lid_w(sign)
    wl = upper_lash_w(sign)
    wlo = lower_lid_w(sign)
    d[:, 2] += -0.012 * wu - 0.010 * wl + 0.010 * wlo
    d[:, 1] += -0.004 * wu - 0.003 * wl
    morphs[f"squint{side}"] = d

# gaze
morphs["gazeX"] = eye_delta(-1, dx=-0.008) + eye_delta(1, dx=-0.008)
morphs["gazeY"] = eye_delta(-1, dz=0.006) + eye_delta(1, dz=0.006)

# pupil
d = zero()
for sign in (-1, 1):
    e = EYE_L if sign < 0 else EYE_R
    w = ellipsoid((e[0], e[1], e[2] - 0.003), (0.016, 0.04, 0.016), 1.2) * (cls == 4) * head * (~rigid)
    d[:, 0] += (x - e[0]) * 0.85 * w
    d[:, 2] += (z - e[2]) * 0.85 * w
morphs["pupilDilate"] = d

# nose
d = zero()
for sign in (-1, 1):
    w = nostril_w(sign)
    d[:, 0] += 0.006 * sign * w
    d[:, 2] += 0.002 * w
    d[:, 1] += -0.001 * w
w = nose_base_w()
d[:, 0] += x * 0.035 * w
d[:, 1] += -0.0015 * w
morphs["noseFlare"] = d

# cheeks
d = zero()
for sign in (-1, 1):
    w = cheek_w(sign)
    d[:, 0] += 0.002 * sign * w
    d[:, 2] += 0.008 * w
    d[:, 1] += -0.001 * w
    wlo = lower_lid_w(sign)
    d[:, 2] += 0.002 * wlo
morphs["cheekRaise"] = d

# jaw
angle = 0.16
hinge = (0.0, 0.0, 0.330)
jaw = jaw_w()
wup = upper_lip_w()
wlo = lower_lip_w()
seam = seam_w()
rot = rotate_x(angle, hinge)
d = (rot - p) * jaw[:, None]
d[:, 1] += 0.016 * seam + 0.006 * wup
d[:, 2] += 0.002 * seam + 0.016 * wup - 0.010 * wlo
d[:, 2] -= 0.004 * teeth_u_m - 0.002 * teeth_l_m
rot_t = rotate_x(angle * 0.45, hinge)
d += (rot_t - p) * tongue_m[:, None]
d[:, 2] += (z - 0.250) * 0.04 * cavity_m
d[:, 1] += 0.004 * cavity_m
morphs["jawOpen"] = d

# mouth width
w = mouth_w()
d = zero()
d[:, 0] = x * 0.14 * w + x * 0.06 * cavity_m + x * 0.04 * (teeth_u_m | teeth_l_m)
morphs["mouthWidth"] = d

# mouth corners
for sign, side in ((-1, "L"), (1, "R")):
    w = corner_w(sign)
    d = zero()
    d[:, 2] = 0.012 * w
    d[:, 0] = 0.003 * sign * w
    morphs[f"mouthCorner{side}"] = d

# lips
d = zero(); d[:, 2] = 0.009 * wup; d[:, 1] = 0.003 * seam
morphs["lipUpperRaise"] = d
d = zero(); d[:, 2] = -0.010 * wlo; d[:, 1] = 0.003 * seam
morphs["lipLowerDrop"] = d
d = zero(); d[:, 2] = -0.004 * wup + 0.004 * wlo
morphs["lipPress"] = d
w = mouth_w()
d = zero()
d[:, 1] = -0.014 * w
d[:, 0] = -x * 0.10 * w
d[:, 2] = -0.003 * wup + 0.003 * wlo
morphs["lipPucker"] = d

# tongue tip face opening
d = zero()
d[:, 2] = 0.004 * wup - 0.004 * wlo
d[:, 1] += 0.008 * seam
d[:, 1] -= 0.018 * tongue_m
d[:, 2] += 0.010 * tongue_m
morphs["tongueTip"] = d

# teeth visible
d = zero()
d[:, 2] = 0.009 * wup - 0.009 * wlo + 0.002 * teeth_u_m - 0.002 * teeth_l_m
d[:, 1] += 0.010 * seam
morphs["teethVisible"] = d

# breath
d = zero()
d[:, 2] = 0.004 * head
neck = (1.0 - smoothstep(0.06, 0.16, z)) * head
d[:, 0] += x * 0.015 * neck
d[:, 1] += (y + 0.02) * 0.015 * neck
morphs["breath"] = d

for name, d in morphs.items():
    slider = (-1.0, 1.0) if name in ("browAngleL", "browAngleR", "gazeX", "gazeY", "mouthWidth") else (0.0, 1.0)
    morph(name, d, slider)
    print("morph", name, "max_delta", float(np.abs(d).max()))

obj.data.update()
for kb in obj.data.shape_keys.key_blocks:
    kb.value = 0.0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "face_morphs.blend"))

# ---------- render previews ----------
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.025, 0.025, 0.03, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.7

def aim(o, target):
    direction = Vector(target) - o.location
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

def add_area(name, loc, energy, size, target=(0, 0, 0.35)):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy = energy
    l.size = size
    o = bpy.data.objects.new(name, l)
    scene.collection.objects.link(o)
    o.location = loc
    aim(o, target)

add_area("key", (-1.1, -1.8, 1.1), 350, 1.4)
add_area("fill", (1.2, -1.2, 0.6), 160, 1.6)
add_area("rim", (0.0, 1.5, 1.0), 250, 1.2)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.15
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, -3, 0.5)
aim(cam, (0, 0, 0.5))

keys = obj.data.shape_keys.key_blocks
def reset():
    for kb in keys:
        kb.value = 0.0

def shot(name, values, closeup=None):
    reset()
    for k, v in values.items():
        keys[k].value = v
    if closeup == "mouth":
        cam_data.ortho_scale = 0.34
        cam.location = (0, -2.5, 0.24)
        aim(cam, (0, 0, 0.24))
    elif closeup == "mouth_side":
        cam_data.ortho_scale = 0.38
        cam.location = (-1.1, -2.2, 0.31)
        aim(cam, (0, -0.40, 0.24))
    elif closeup == "eyes":
        cam_data.ortho_scale = 0.42
        cam.location = (0, -2.5, 0.47)
        aim(cam, (0, 0, 0.47))
    else:
        cam_data.ortho_scale = 1.15
        cam.location = (0, -3, 0.5)
        aim(cam, (0, 0, 0.5))
    scene.render.filepath = os.path.join(PREV, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("shot", name)

shot("rest", {})
shot("jaw_open", {"jawOpen": 1.0}, "mouth")
shot("jaw_open_side", {"jawOpen": 1.0}, "mouth_side")
shot("jaw_open_half", {"jawOpen": 0.5}, "mouth")
shot("jaw_open_front", {"jawOpen": 1.0})
shot("blink", {"eyelidOpenL": 1.0, "eyelidOpenR": 1.0}, "eyes")
shot("blink_front", {"eyelidOpenL": 1.0, "eyelidOpenR": 1.0})
shot("squint", {"squintL": 1.0, "squintR": 1.0}, "eyes")
shot("brow_raise", {"browRaiseL": 1.0, "browRaiseR": 1.0})
shot("brow_angle", {"browAngleL": 1.0, "browAngleR": 1.0})
shot("gaze_right", {"gazeX": 1.0}, "eyes")
shot("gaze_up", {"gazeY": 1.0}, "eyes")
shot("pupil", {"pupilDilate": 1.0}, "eyes")
shot("mouth_width", {"mouthWidth": 1.0}, "mouth")
shot("mouth_width_neg", {"mouthWidth": -1.0}, "mouth")
shot("corners", {"mouthCornerL": 1.0, "mouthCornerR": 1.0}, "mouth")
shot("lip_upper", {"lipUpperRaise": 1.0}, "mouth")
shot("lip_lower", {"lipLowerDrop": 1.0}, "mouth")
shot("lip_press", {"lipPress": 1.0}, "mouth")
shot("lip_pucker", {"lipPucker": 1.0}, "mouth")
shot("teeth", {"teethVisible": 1.0}, "mouth")
shot("tongue", {"tongueTip": 1.0}, "mouth")
shot("nose", {"noseFlare": 1.0})
shot("cheek", {"cheekRaise": 1.0})
shot("breath", {"breath": 1.0})
shot("viseme_a", {"jawOpen": 0.95, "mouthWidth": 0.2, "lipUpperRaise": 0.15, "lipLowerDrop": 0.25, "teethVisible": 0.35}, "mouth")
shot("viseme_o", {"jawOpen": 0.55, "mouthWidth": -0.5, "lipPucker": 0.8, "lipLowerDrop": 0.2}, "mouth")
shot("viseme_mbp", {"lipPress": 1.0, "mouthWidth": -0.05}, "mouth")
shot("viseme_i", {"jawOpen": 0.35, "mouthWidth": 0.35, "lipUpperRaise": 0.25, "lipLowerDrop": 0.1, "teethVisible": 0.6}, "mouth")

reset()
print("DONE")
