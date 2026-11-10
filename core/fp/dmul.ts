// DMUL: two-compartment dendritic coincidence (Larkum 1999; Larkum 2013). y = relu(basal) * sigmoid(gA*(apical - th)).
export const dmulOut = (basal: number, apical: number, gA = 4, th = 0.5): number => Math.max(0, basal) / (1 + Math.exp(-gA * (apical - th)));
export const addOut = (basal: number, apical: number): number => Math.max(0, basal) + Math.max(0, apical) * 0.5; // additive control
