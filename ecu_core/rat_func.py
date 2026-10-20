"""Correct A2L RAT_FUNC raw-to-physical inverse; no guessing for ambiguous roots."""
import math
def raw_to_physical(raw, coeffs):
    """Solve raw=(a*p^2+b*p+c)/(d*p^2+e*p+f)."""
    a,b,c,d,e,f=coeffs
    A=a-raw*d; B=b-raw*e; C=c-raw*f
    if abs(A)<1e-10:
        return -C/B if abs(B)>1e-12 else None
    disc=B*B-4*A*C
    if disc<0:return None
    roots=[(-B+math.sqrt(disc))/(2*A),(-B-math.sqrt(disc))/(2*A)]
    if abs(roots[0]-roots[1])<1e-9:return roots[0]
    return None
