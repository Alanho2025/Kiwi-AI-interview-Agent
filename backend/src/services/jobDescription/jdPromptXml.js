const toPromptText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value, null, 2);
  return serialized === undefined ? '' : serialized;
};

export const escapeJdPromptXml = (value) => toPromptText(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const escapeAttribute = (value) => escapeJdPromptXml(value);

const buildStaticElement = (name, value) => `<${name}>${escapeJdPromptXml(value)}</${name}>`;

export const buildJdSystemPrompt = ({
  flow,
  roleAndAuthority,
  objective,
  inputContext,
  evidenceBoundary,
  constraints,
  outputAndFailure,
}) => `<jd_prompt_contract version="jd-six-elements-v1" flow="${escapeAttribute(flow)}">
  ${buildStaticElement('role_and_authority', roleAndAuthority)}
  ${buildStaticElement('objective', objective)}
  ${buildStaticElement('input_context', inputContext)}
  ${buildStaticElement('evidence_boundary', evidenceBoundary)}
  ${buildStaticElement('constraints', constraints)}
  ${buildStaticElement('output_and_failure', outputAndFailure)}
</jd_prompt_contract>`;

export const buildJdInputPrompt = ({ flow, inputData = [], evidenceBoundary }) => {
  const dataNodes = inputData
    .map(({ name, value }) => `    <${name} trust="untrusted">${escapeJdPromptXml(value)}</${name}>`)
    .join('\n');

  return `<jd_input_bundle version="jd-six-elements-v1" flow="${escapeAttribute(flow)}">
  <input_context>
${dataNodes}
  </input_context>
  ${buildStaticElement('evidence_boundary', evidenceBoundary)}
</jd_input_bundle>`;
};
