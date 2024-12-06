/**
 * Return a string with the same whitespace characters as at the beginning of `s`
 * 
 * @param s
 */
export const getWhitespace = (s: string) => {
    const match = s.match(/^\s*/);
    return match ? match[0] : '';
};
