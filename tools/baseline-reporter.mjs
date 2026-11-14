// This reporter is used only by the manual baseline capture tool.
export default async function* report(events) {
  for await (const event of events) {
    if (["test:pass", "test:fail", "test:summary"].includes(event.type)) {
      const { file, name, nesting, details, counts } = event.data;
      yield JSON.stringify({ event: event.type, file, name, nesting, type: details?.type, counts }) + "\n";
    }
  }
}
