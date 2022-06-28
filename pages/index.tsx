import { useEffect, useState } from "react";

export default function Index() {
  return (
    <div>
      <Form />
    </div>
  );
}

type DataItem =
  | {
      type: "error";
      message: string;
      date: Date;
    }
  | {
      type: "chunk";
      data: string;
      date: Date;
    };

const defaultUrl =
  typeof window !== "undefined" &&
  new URL(window.location.href).searchParams.get("url");

function Form() {
  const [current, setCurrent] = useState(() => ({
    request: new Request(defaultUrl || "https://example.vercel.sh/"),
    abortController: new AbortController(),
  }));
  const [data, setData] = useState<DataItem[]>([]);

  const setUrl = (request: Request) => {
    setCurrent({ request, abortController: new AbortController() });
  };

  useEffect(() => {
    setData([]);
    fetch(current.request, {
      signal: current.abortController.signal,
    }).then(
      async (response) => {
        const headersString =
          "HEADERS:\n" +
          [...response.headers]
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        setData((d) => [
          ...d,
          { type: "chunk", data: headersString, date: new Date() },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const read = await reader.read();
          if (read.value) {
            const data = decoder.decode(read.value);
            setData((d) => [...d, { type: "chunk", data, date: new Date() }]);
          }
          if (read.done) {
            break;
          }
        }
      },
      (err) => {
        if (current.abortController.signal.aborted) {
          return;
        }
        setData((d) => [
          ...d,
          { type: "error", message: err.message, date: new Date() },
        ]);
      }
    );
    return () => {
      current.abortController.abort();
    };
  }, [current]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const url = formData.get("url") as string;
          setUrl(new Request(url));
        }}
      >
        <input
          name="url"
          type="url"
          placeholder="url"
          defaultValue={current.request.url}
        />
      </form>
      <h2>data</h2>
      <ul>
        {data.map((item, index) => {
          return (
            <li key={index}>
              {item.type === "error" ? (
                <span style={{ color: "red", fontWeight: "bold" }}>
                  ERROR: ${item.message}
                </span>
              ) : (
                <code title={item.date.toISOString()}>{item.data}</code>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
