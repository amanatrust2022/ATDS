export type HierarchicalParameter = {
  name: string;
  unit: string;
  range: string;
  children?: HierarchicalParameter[];
};

/** Qualifies child names so hierarchy survives in stored and printed rows. */
export const flattenTestParameters = <T extends HierarchicalParameter>(
  parameters: T[],
  ancestors: string[] = [],
): HierarchicalParameter[] => parameters.flatMap((parameter) => {
  const children = parameter.children || [];
  if (children.length === 0) {
    return [{ ...parameter, name: [...ancestors, parameter.name].filter(Boolean).join(' — '), children: undefined }];
  }
  return flattenTestParameters(children, [...ancestors, parameter.name]);
});
