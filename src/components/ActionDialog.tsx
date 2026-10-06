import { useEffect, useRef, useState } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "./RemoteTable";

type Field = {
  name: string;
  label: string;
  value?: string;
  type?: "text" | "number";
  options?: Array<{ value: string; label: string }>;
  pattern?: string;
  min?: number;
  max?: number;
  maxLength?: number;
};
type Request = {
  title: string;
  description?: string;
  fields?: Field[];
  confirm?: string;
};
export function useActionDialog() {
  const [request, setRequest] = useState<Request | null>(null),
    [values, setValues] = useState<Record<string, string>>({});
  const resolve = useRef<
    ((value: Record<string, string> | null) => void) | null
  >(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = (value: Record<string, string> | null) => {
    const finish = resolve.current;
    resolve.current = null;
    setRequest(null);
    finish?.(value);
  };
  useEffect(
    () => () => {
      resolve.current?.(null);
      resolve.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>("input, select, button")
      ?.focus();
    return () => previous?.focus();
  }, [request]);
  const ask = (next: Request) => {
    resolve.current?.(null);
    setValues(
      Object.fromEntries(
        (next.fields || []).map((field) => [field.name, field.value || ""]),
      ),
    );
    setRequest(next);
    return new Promise<Record<string, string> | null>((finish) => {
      resolve.current = finish;
    });
  };
  const dialog = request ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-action-title"
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-ink p-6 shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close(null);
          }
          if (event.key === "Tab") {
            const fields = dialogRef.current?.querySelectorAll<HTMLElement>(
              "input, select, button",
            );
            if (!fields?.length) return;
            const first = fields[0],
              last = fields[fields.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id="support-action-title" className="text-xl font-semibold">
          {request.title}
        </h2>
        {request.description ? (
          <p className="mt-2 text-sm text-slate-400">{request.description}</p>
        ) : null}
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            close(values);
          }}
        >
          {request.fields?.map((field) => (
            <label key={field.name} className="block text-sm">
              {field.label}
              {field.options ? (
                <select
                  required
                  value={values[field.name] || ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                  className={`${inputClass} mt-2 w-full`}
                >
                  <option value="">Select an option</option>
                  {field.options.map((option) => (
                    <option
                      className="bg-ink"
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type={field.type || "text"}
                  pattern={field.pattern}
                  min={field.min}
                  max={field.max}
                  step={field.type === "number" ? "any" : undefined}
                  maxLength={field.maxLength || 4000}
                  value={values[field.name] || ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                  className={`${inputClass} mt-2 w-full`}
                />
              )}
            </label>
          ))}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => close(null)}
            >
              Cancel
            </button>
            <button type="submit" className={buttonClass}>
              {request.confirm || "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;
  return { ask, dialog };
}
