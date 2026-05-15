/**
 * Échappe les caractères spéciaux d'une regex pour éviter les attaques ReDoS
 * et les injections NoSQL via $regex
 * 
 * @param str - La chaîne à échapper
 * @returns La chaîne échappée, sûre pour utilisation dans une regex
 */
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
