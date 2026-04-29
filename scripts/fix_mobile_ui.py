import re

path = '/workspaces/27/scripts/add_mobile.py'
with open(path, 'r') as f:
    c = f.read()

# 1. Remove Kaspa DAG from hero
c = c.replace('High Table Protocol &middot; Kaspa DAG', 'High Table Protocol')

# 2. Remove mob-gc-desc lines
c = re.sub(r"          <div class=.mob-gc-desc.>.*?</div>\n", '', c)

# 3. Add icon field to game cards
for game, icon in [('chess','♟️'),('checkers','🔴'),('connect4','🟡'),('tictactoe','✖️'),('holdem','🃏'),('blackjack','🂡')]:
    c = c.replace(
        f"onclick=\"mobOpenGame('{game}')\">\n          <div class=\"mob-gc-cat\">",
        f"onclick=\"mobOpenGame('{game}')\">\n          <div class=\"mob-gc-cat\">"
    )
    c = c.replace(
        f"onclick=\"mobOpenGame('{game}')\">\n          <div class=\"mob-gc-cat\">",
        f"onclick=\"mobOpenGame('{game}')\">\n          <div class=\"mob-gc-icon\" style=\"font-size:30px;margin-bottom:6px;line-height:1\">{icon}</div>\n          <div class=\"mob-gc-cat\">"
    )

# 4. Boost game card name size + cat color
c = c.replace(
    '.mob-gc-cat{font-size:8px;font-weight:800;color:#475569;',
    '.mob-gc-cat{font-size:9px;font-weight:800;color:#49e8c2;'
)
c = c.replace(
    '.mob-gc-name{font-size:15px;font-weight:900;color:#e2e8f0;margin-bottom:3px}',
    '.mob-gc-name{font-size:17px;font-weight:900;color:#f1f5f9;margin-bottom:10px}'
)

# 5. Lift all dim text colors
c = c.replace('color:#475569', 'color:#94a3b8')
c = c.replace('color:#334155', 'color:#64748b')

with open(path, 'w') as f:
    f.write(c)

print('Kaspa DAG removed:', 'Kaspa DAG' not in c)
print('mob-gc-desc removed:', 'mob-gc-desc' not in c)
print('icon injected:', 'mob-gc-icon' in c)
print('cat color green:', 'color:#49e8c2' in c)
