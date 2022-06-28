import { useEffect, useState } from "react";
import { useRouter } from "../node_modules/next/router";

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
  | { type: "headers"; headers: [string, string][]; date: Date }
  | {
      type: "chunk";
      data: string;
      date: Date;
    };

const defaultUrl =
  typeof window !== "undefined" &&
  new URL(window.location.href).searchParams.get("url");

function parseHeadersFromQp(qp: URLSearchParams): Headers {
  const headers = new Headers();
  qp.forEach((value, key) => {
    if (key === "headers") {
      const [name, header] = value.split("=");
      if (name && header) {
        headers.set(name, header);
      }
    }
  });
  return headers;
}

function Form() {
  const [current, setCurrent] = useState(() => ({
    request: new Request(defaultUrl || "https://example.vercel.sh/", {
      headers:
        typeof window === "undefined"
          ? undefined
          : parseHeadersFromQp(new URL(window.location.href).searchParams),
    }),
    abortController: new AbortController(),
  }));
  const [data, setData] = useState<DataItem[]>([]);
  const router = useRouter();
  const [numberOfHeaders, setNumberOfHeaders] = useState(0);

  const setUrl = (request: Request) => {
    setCurrent({ request, abortController: new AbortController() });
  };

  useEffect(() => {
    const qp = new URLSearchParams();
    current.request.headers.forEach((value, key) => {
      qp.append(`headers`, `${key}=${value}`);
    });
    qp.set("url", current.request.url);
    router.push(`/?${qp}`, undefined, {
      shallow: true,
    });
    setData([]);

    fetch(current.request, {
      signal: current.abortController.signal,
    }).then(
      async (response) => {
        setData((d) => [
          ...d,
          { type: "headers", headers: [...response.headers], date: new Date() },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          if (current.abortController.signal.aborted) {
            return;
          }
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
          const headers = formData.getAll("headers");
          const headersArray = headers
            .map((x) => String(x).split("="))
            .filter((x): x is [string, string] => x.length === 2);
          setUrl(
            new Request(url, {
              headers: headersArray,
            })
          );
        }}
      >
        <fieldset>
          <input
            name="url"
            type="url"
            placeholder="url"
            defaultValue={current.request.url}
          />
          {Array.from({ length: numberOfHeaders }, (_, i) => {
            return (
              <li key={i}>
                <input name="headers" placeholder="HEADER=VALUE" />
              </li>
            );
          })}
          <div>
            <button
              type="button"
              onClick={() => setNumberOfHeaders((i) => i + 1)}
            >
              add header
            </button>
          </div>
          <div>
            <button type="submit">submit</button>
          </div>
        </fieldset>
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
              ) : item.type === "headers" ? (
                <table>
                  <thead>
                    <tr>
                      <td colSpan={2}>headers</td>
                    </tr>
                  </thead>
                  <tbody>
                    {item.headers.map(([key, value], index) => (
                      <tr key={index}>
                        <td style={{ opacity: 0.5 }}>{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
