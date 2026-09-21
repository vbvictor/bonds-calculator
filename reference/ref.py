"""
Референсная реализация модели. Источник эталонных чисел для приёмочных тестов.
См. ТЗ, раздел 3. Не изменять без пересчёта тестов раздела 7.
"""
FACE = 1000.0

def ks_at(path, m, shift=0.0, mode="step"):
    """path = [(month, rate_pct)], отсортирован по month.
    mode="step"   — ступенчато: ставка держится до следующей точки (как решения ЦБ).
    mode="linear" — линейная интерполяция между точками."""
    p = sorted(path, key=lambda x: x[0])
    if m <= p[0][0]:
        return p[0][1] + shift
    if m >= p[-1][0]:
        return p[-1][1] + shift
    if mode == "step":
        cur = p[0][1]
        for pt in p:
            if pt[0] <= m:
                cur = pt[1]
            else:
                break
        return cur + shift
    for i in range(len(p) - 1):
        if p[i][0] <= m <= p[i+1][0]:
            w = (m - p[i][0]) / (p[i+1][0] - p[i][0])
            return p[i][1] + (p[i+1][1] - p[i][1]) * w + shift
    return p[0][1] + shift

def grow(amount, frm, H, path, reinv, shift=0.0, mode="step"):
    v = amount
    for t in range(frm, H):
        v *= (1 + (ks_at(path, t, shift, mode)/100.0 + reinv)/12.0)
    return v

def floater(path, H, spread, price_pct, freq, lag, reinv, shift=0.0, mode="step"):
    step = round(12/freq); pot = 0.0; first = None
    m = step
    while m <= H:
        set_m = max(0, m - step - lag)
        c = FACE * (ks_at(path, set_m, shift, mode)/100.0 + spread) / freq
        if first is None: first = c
        pot += grow(c, m, H, path, reinv, shift, mode)
        m += step
    fv = FACE + pot; price = price_pct/100.0*FACE
    return fv, (fv/price)**(12.0/H) - 1, first

def fixed(path, H, coupon, price_pct, freq, reinv, shift=0.0, mode="step"):
    step = round(12/freq); pot = 0.0
    m = step
    while m <= H:
        pot += grow(FACE*coupon/freq, m, H, path, reinv, shift, mode)
        m += step
    fv = FACE + pot; price = price_pct/100.0*FACE
    return fv, (fv/price)**(12.0/H) - 1

if __name__ == "__main__":
    pathA = [(0, 14.0)]
    fvF, rF, c1 = floater(pathA, 36, 0.015, 100.0, 4, 0, 0.01)
    fvX, rX = fixed(pathA, 36, 0.155, 99.0, 2, 0.01)
    print("TEST A flat 14%%: floater FV=%.4f r=%.6f first=%.4f | fixed FV=%.4f r=%.6f"
          % (fvF, rF, c1, fvX, rX))

    pathB = [(0,14.0),(6,13.5),(12,12.5),(24,10.5)]
    fvF, rF, _ = floater(pathB, 36, 0.015, 100.2, 4, 1, 0.01)
    fvX, rX = fixed(pathB, 36, 0.155, 99.0, 2, 0.01)
    avg = sum(ks_at(pathB,i) for i in range(37))/37
    print("TEST B step: floater FV=%.4f r=%.6f | fixed FV=%.4f r=%.6f | gap=%.4f | avgKS=%.4f"
          % (fvF, rF, fvX, rX, (rF-rX)*100, avg))

    print("TEST C step ksAt:", [ (m, ks_at(pathB,m)) for m in [0,5,6,11,12,23,24,36] ])
    print("TEST C linear   :", [ (m, ks_at(pathB,m,0,"linear")) for m in [0,3,6,9,12,18,24,36] ])

    fv0, r0 = fixed([(0,0.0)], 36, 0.0, 75.0, 2, 0.0)
    print("TEST D zero-coupon r=%.6f expect=%.6f" % (r0, (1/0.75)**(1/3.0)-1))

    # real CBR meeting calendar preset, offsets from 2026-09-21
    pathReal = [(0,14.0),(1,13.5),(3,13.0),(5,12.5),(6,12.0),(7,11.5),(9,11.0),(10,10.5),(12,10.0)]
    fvF, rF, _ = floater(pathReal, 36, 0.015, 100.2, 4, 1, 0.01)
    fvX, rX = fixed(pathReal, 36, 0.155, 99.0, 2, 0.01)
    print("TEST G calendar: floater r=%.6f | fixed r=%.6f | gap=%.4f" % (rF, rX, (rF-rX)*100))
