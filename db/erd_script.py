"""
대학 중고거래 플랫폼 ERD 생성 스크립트
출력: ERD.jpg
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Rectangle

# Use default font to avoid slow font-cache rebuild on first run
plt.rcParams['axes.unicode_minus'] = False

# ── Design tokens ─────────────────────────────────────────────────────────────
C = {
    'bg':       '#F4F6F9',
    'hdr':      '#2D3561',
    'hdr_fg':   '#FFFFFF',
    'pk_bg':    '#D6EAF8',
    'fk_bg':    '#FDEBD0',
    'row_bg':   '#FFFFFF',
    'border':   '#AEB6BF',
    'pk_badge': '#1565C0',
    'fk_badge': '#BF360C',
    'pk_fg':    '#1A5276',
    'fk_fg':    '#784212',
    'row_fg':   '#2C3E50',
    'line':     '#6C7A89',
    'shadow':   '#00000018',
    'title':    '#2D3561',
    'sect':     '#7D3C98',
}

TW = 4.0    # table width
HH = 0.52   # header height
RH = 0.37   # row height
GAP = 0.5   # column gap


def tbl_h(cols):
    return HH + len(cols) * RH


def draw_table(ax, name, cols, x, y_top):
    """Draw one ERD table. Returns anchor dict."""
    h = tbl_h(cols)

    # Drop shadow
    ax.add_patch(FancyBboxPatch(
        (x + 0.08, y_top - h - 0.08), TW, h,
        boxstyle='round,pad=0.07', fc=C['shadow'], ec='none', zorder=1))

    # Body background
    ax.add_patch(FancyBboxPatch(
        (x, y_top - h), TW, h,
        boxstyle='round,pad=0.07', fc=C['row_bg'], ec=C['border'],
        lw=1.3, zorder=2))

    # Header band
    ax.add_patch(Rectangle(
        (x, y_top - HH), TW, HH,
        fc=C['hdr'], ec='none', zorder=3))
    # Round top corners by layering a rounded box on header
    ax.add_patch(FancyBboxPatch(
        (x, y_top - HH), TW, HH,
        boxstyle='round,pad=0.07', fc=C['hdr'], ec='none', zorder=3,
        clip_on=False))
    ax.text(x + TW / 2, y_top - HH / 2, name,
            ha='center', va='center', color=C['hdr_fg'],
            fontsize=8.5, fontweight='bold', zorder=4)

    # Column rows
    for i, (col, pk, fk) in enumerate(cols):
        ry = y_top - HH - i * RH
        bg = C['pk_bg'] if pk else (C['fk_bg'] if fk else C['row_bg'])
        ax.add_patch(Rectangle(
            (x, ry - RH), TW, RH,
            fc=bg, ec=C['border'], lw=0.4, zorder=2))

        if pk or fk:
            badge_color = C['pk_badge'] if pk else C['fk_badge']
            label = 'PK' if pk else 'FK'
            ax.add_patch(FancyBboxPatch(
                (x + 0.10, ry - RH + 0.06), 0.44, RH - 0.12,
                boxstyle='round,pad=0.03', fc=badge_color, ec='none', zorder=3))
            ax.text(x + 0.32, ry - RH / 2, label,
                    ha='center', va='center', color='white',
                    fontsize=5.5, fontweight='bold', zorder=4)

        fg = C['pk_fg'] if pk else (C['fk_fg'] if fk else C['row_fg'])
        ax.text(x + 0.65, ry - RH / 2, col,
                ha='left', va='center', color=fg, fontsize=7.0, zorder=4)

    # Divider line between header and body
    ax.plot([x, x + TW], [y_top - HH, y_top - HH],
            color=C['border'], lw=0.8, zorder=3)

    return {
        'tm': (x + TW / 2, y_top),
        'bm': (x + TW / 2, y_top - h),
        'lm': (x, y_top - h / 2),
        'rm': (x + TW, y_top - h / 2),
        'lt': (x, y_top),
        'rt': (x + TW, y_top),
    }


def arrow(ax, p1, p2, rad=0.0, color=None, lw=1.1, style='-|>'):
    c = color or C['line']
    ax.annotate('', xy=p2, xytext=p1,
                 arrowprops=dict(
                     arrowstyle=style, color=c, lw=lw,
                     mutation_scale=9,
                     connectionstyle=f'arc3,rad={rad}'),
                 zorder=0)


# ── Figure ────────────────────────────────────────────────────────────────────
FW, FH = 29, 22
fig, ax = plt.subplots(figsize=(FW, FH))
ax.set_xlim(-0.5, FW - 0.5)
ax.set_ylim(-0.5, FH - 0.5)
ax.set_aspect('equal')
ax.axis('off')
fig.patch.set_facecolor(C['bg'])
ax.set_facecolor(C['bg'])

# ── Column X positions ────────────────────────────────────────────────────────
X0, X1, X2, X3 = 0.3, 5.8, 11.3, 16.8

# ── Table definitions (x, y_top, columns) ────────────────────────────────────
TABLES = {
    # ── Col 0 ──────────────────────────────────────────────────────────────
    'User': (X0, 20.5, [
        ('uid',                True,  False),
        ('email',              False, False),
        ('password_hash',      False, False),
        ('nickname',           False, False),
        ('student_id',         False, False),
        ('school_domain',      False, False),
        ('profile_image_url',  False, False),
        ('bio',                False, False),
        ('preferred_region_id',False, True),
        ('joined_at',          False, False),
        ('manner_temperature', False, False),
        ('trade_count',        False, False),
        ('is_suspended',       False, False),
        ('warning_count',      False, False),
        ('deleted_at',         False, False),
    ]),
    'Region': (X0, 13.8, [
        ('region_id', True,  False),
        ('name',      False, False),
    ]),
    'Report': (X0, 10.0, [
        ('report_id',   True,  False),
        ('reporter_uid',False, True),
        ('target_uid',  False, True),
        ('reason',      False, False),
        ('created_at',  False, False),
    ]),
    'ReportEvidence': (X0, 6.9, [
        ('evidence_id', True,  False),
        ('report_id',   False, True),
        ('image_url',   False, False),
    ]),

    # ── Col 1 ──────────────────────────────────────────────────────────────
    'Product': (X1, 20.5, [
        ('pid',         True,  False),
        ('seller_uid',  False, True),
        ('category_id', False, True),
        ('title',       False, False),
        ('price',       False, False),
        ('condition',   False, False),
        ('description', False, False),
        ('status',      False, False),
        ('created_at',  False, False),
        ('updated_at',  False, False),
        ('deleted_at',  False, False),
    ]),
    'Wishlist': (X1, 15.5, [
        ('wishlist_id', True,  False),
        ('uid',         False, True),
        ('pid',         False, True),
        ('created_at',  False, False),
    ]),
    'Transaction': (X1, 11.8, [
        ('transaction_id', True,  False),
        ('pid',            False, True),
        ('buyer_uid',      False, True),
        ('seller_uid',     False, True),
        ('agreed_price',   False, False),
        ('status',         False, False),
        ('completed_at',   False, False),
    ]),
    'UserPenalty': (X1, 7.5, [
        ('penalty_id', True,  False),
        ('uid',        False, True),
        ('type',       False, False),
        ('issued_at',  False, False),
        ('expires_at', False, False),
    ]),

    # ── Col 2 ──────────────────────────────────────────────────────────────
    'Category': (X2, 20.5, [
        ('category_id', True,  False),
        ('parent_id',   False, True),
        ('name',        False, False),
    ]),
    'ProductImage': (X2, 18.5, [
        ('image_id',     True,  False),
        ('pid',          False, True),
        ('image_url',    False, False),
        ('display_order',False, False),
    ]),
    'ChatRoom': (X2, 16.2, [
        ('room_id',    True,  False),
        ('product_id', False, True),
        ('created_at', False, False),
    ]),
    'Review': (X2, 12.5, [
        ('review_id',      True,  False),
        ('transaction_id', False, True),
        ('reviewer_uid',   False, True),
        ('reviewee_uid',   False, True),
        ('rating',         False, False),
        ('content',        False, False),
        ('created_at',     False, False),
    ]),

    # ── Col 3 ──────────────────────────────────────────────────────────────
    'ChatParticipant': (X3, 16.2, [
        ('cp_id',        True,  False),
        ('room_id',      False, True),
        ('uid',          False, True),
        ('last_read_at', False, False),
    ]),
    'MannerKeyword': (X3, 12.5, [
        ('keyword_id', True,  False),
        ('label',      False, False),
    ]),
    'ReviewKeyword': (X3, 10.2, [
        ('review_id',  True, True),
        ('keyword_id', True, True),
    ]),
}

# ── Draw all tables ───────────────────────────────────────────────────────────
A = {}
for name, (x, y, cols) in TABLES.items():
    A[name] = draw_table(ax, name, cols, x, y)

# ── Section labels ────────────────────────────────────────────────────────────
for label, x, y in [
    ('User / Region', X0 + TW / 2, 20.3),
    ('Product / Trade', X1 + TW / 2, 20.3),
    ('Category / Chat / Review', X2 + TW / 2, 20.3),
    ('ChatPart / MannerKW', X3 + TW / 2, 20.3),
]:
    ax.text(x, y, label, ha='center', va='bottom', color=C['sect'],
            fontsize=7, style='italic')

# ── Relationships ─────────────────────────────────────────────────────────────

# ① User → Region (preferred_region_id)
arrow(ax, A['User']['bm'], A['Region']['tm'])

# ② Product → User (seller_uid)
arrow(ax, A['Product']['lm'], A['User']['rm'])

# ③ Product → Category (category_id)
arrow(ax, A['Product']['rm'], A['Category']['lm'])

# ③-b Category self-reference (parent_id) — small loop arrow on Category
arrow(ax, A['Category']['rm'],
      (A['Category']['rm'][0] + 0.6, A['Category']['rm'][1] - 0.5),
      rad=-0.5, color='#9B59B6')

# ④ ProductImage → Product (pid)
arrow(ax, A['ProductImage']['lm'], A['Product']['rm'], rad=0.15)

# ⑤ Wishlist → Product (pid)
arrow(ax, A['Wishlist']['tm'], A['Product']['bm'])

# ⑥ Wishlist → User (uid) — curved left
arrow(ax, A['Wishlist']['lm'], A['User']['bm'], rad=0.25)

# ⑦ ChatRoom → Product (product_id) — left + upward
arrow(ax, A['ChatRoom']['lm'], A['Product']['rm'], rad=-0.2)

# ⑧ ChatParticipant → ChatRoom (room_id)
arrow(ax, A['ChatParticipant']['lm'], A['ChatRoom']['rm'])

# ⑨ ChatParticipant → User (uid) — long arc across top
arrow(ax, A['ChatParticipant']['tm'],
      (A['User']['rm'][0], A['User']['rm'][1] - 1.5),
      rad=-0.35)

# ⑩ Transaction → Product (pid) — route via right side to avoid Wishlist
arrow(ax, A['Transaction']['rm'], A['Product']['bm'], rad=-0.25)

# ⑪ Transaction → User (buyer_uid / seller_uid)
arrow(ax, A['Transaction']['lm'], A['User']['bm'], rad=0.2)

# ⑫ Review → Transaction (transaction_id)
arrow(ax, A['Review']['lm'], A['Transaction']['rm'])

# ⑬ Review → User (reviewer_uid / reviewee_uid) — arc
arrow(ax, A['Review']['lm'],
      (A['User']['bm'][0], A['User']['bm'][1] + 0.5),
      rad=0.3)

# ⑭ ReviewKeyword → Review (review_id)
arrow(ax, A['ReviewKeyword']['lm'], A['Review']['rm'], rad=0.2)

# ⑮ ReviewKeyword → MannerKeyword (keyword_id)
arrow(ax, A['ReviewKeyword']['tm'], A['MannerKeyword']['bm'])

# ⑯ Report → User (target_uid) — right-arc to bypass Region
arrow(ax, A['Report']['rm'],
      (A['User']['bm'][0] + 0.6, A['User']['bm'][1]),
      rad=0.35)

# ⑯-b Report → User (reporter_uid) — slightly different arc
arrow(ax, A['Report']['rm'],
      (A['User']['bm'][0] + 1.2, A['User']['bm'][1]),
      rad=0.45)

# ⑰ ReportEvidence → Report (report_id)
arrow(ax, A['ReportEvidence']['tm'], A['Report']['bm'])

# ⑱ UserPenalty → User (uid) — left arc
arrow(ax, A['UserPenalty']['lm'],
      (A['User']['bm'][0], A['User']['bm'][1] - 0.3),
      rad=-0.15)

# ── Title ─────────────────────────────────────────────────────────────────────
ax.text(13.5, 21.3, 'University Marketplace Platform  -  ERD  (v2)',
        ha='center', va='center', color=C['title'],
        fontsize=14, fontweight='bold')

# ── Legend ────────────────────────────────────────────────────────────────────
lx, ly = 21.8, 20.3
ax.add_patch(FancyBboxPatch(
    (lx - 0.2, ly - 3.6), 6.6, 3.9,
    boxstyle='round,pad=0.12',
    fc='#FFFFFF', ec=C['border'], lw=1.0, zorder=5))

ax.text(lx + 3.1, ly - 0.1, 'Legend', ha='center', va='top',
        color=C['title'], fontsize=9, fontweight='bold', zorder=6)

legend_items = [
    (C['pk_bg'], C['pk_badge'], 'PK  Primary Key'),
    (C['fk_bg'], C['fk_badge'], 'FK  Foreign Key'),
    (C['row_bg'], C['row_fg'],  'Column'),
]
for i, (bg, fg, text) in enumerate(legend_items):
    iy = ly - 0.72 * (i + 1)
    ax.add_patch(FancyBboxPatch(
        (lx, iy - 0.22), 0.5, 0.42,
        boxstyle='round,pad=0.04',
        fc=bg, ec=C['border'], lw=0.8, zorder=6))
    ax.text(lx + 0.65, iy, text,
            ha='left', va='center', color=fg, fontsize=8, zorder=6)

# Arrow legend — FK reference
ay = ly - 0.72 * (len(legend_items) + 1) + 0.15
ax.annotate('', xy=(lx + 0.5, ay), xytext=(lx, ay),
            arrowprops=dict(arrowstyle='-|>', color=C['line'],
                            lw=1.1, mutation_scale=9), zorder=6)
ax.text(lx + 0.65, ay, 'FK Reference',
        ha='left', va='center', color=C['row_fg'], fontsize=8, zorder=6)

# Arrow legend — self-reference
ay2 = ay - 0.72
ax.annotate('', xy=(lx + 0.5, ay2), xytext=(lx, ay2),
            arrowprops=dict(arrowstyle='-|>', color='#9B59B6',
                            lw=1.1, mutation_scale=9), zorder=6)
ax.text(lx + 0.65, ay2, 'Self-Reference (Category)',
        ha='left', va='center', color='#9B59B6', fontsize=8, zorder=6)

# ── Save ──────────────────────────────────────────────────────────────────────
out = 'ERD.jpg'
plt.savefig(out, dpi=160, bbox_inches='tight',
            facecolor=C['bg'], edgecolor='none',
            pil_kwargs={'quality': 95})
plt.close()
print(f'[OK] {out} saved.')
