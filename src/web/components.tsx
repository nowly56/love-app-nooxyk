import React, { useEffect, useRef, useState } from "react";

const iconPaths = {
  book: "M12 6.5c-2.4-1.6-5-2-9-1.7v14c3.9-.4 6.7.2 9 1.8 2.3-1.6 5.1-2.2 9-1.8v-14c-4-.3-6.6.1-9 1.7Zm0 0v14",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  photos: "M4 3h16v18H4z M4 15l5-5 5 5 3-3 3 3 M15 7h.01",
  settings:
    "M10 2h4l.6 2.3c.6.2 1.1.4 1.6.7l2.1-1.2 2.8 2.8-1.2 2.1c.3.5.5 1 .7 1.6L23 11v4l-2.4.6c-.2.6-.4 1.1-.7 1.6l1.2 2.1-2.8 2.8-2.1-1.2c-.5.3-1 .5-1.6.7L14 24h-4l-.6-2.4c-.6-.2-1.1-.4-1.6-.7l-2.1 1.2-2.8-2.8 1.2-2.1c-.3-.5-.5-1-.7-1.6L1 15v-4l2.4-.6c.2-.6.4-1.1.7-1.6L2.9 6.7l2.8-2.8 2.1 1.2c.5-.3 1-.5 1.6-.7L10 2Zm2 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  plus: "M12 5v14 M5 12h14",
  camera: "M3 7h4l2-3h6l2 3h4v14H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  close: "M6 6l12 12 M18 6 6 18",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z",
};
export type IconName = keyof typeof iconPaths;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "camera" ? (
        <>
          <path
            d="M5 7h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="12"
            cy="13"
            r="3.4"
            fill="var(--camera-cutout, #f7e8dc)"
            stroke="none"
          />
        </>
      ) : (
        <path d={iconPaths[name]} />
      )}
    </svg>
  );
}

export function Avatar({
  name,
  photoUrl,
  large = false,
}: {
  name: string;
  photoUrl?: string;
  large?: boolean;
}) {
  const [failedPhoto, setFailedPhoto] = useState("");
  const showPhoto = Boolean(photoUrl && failedPhoto !== photoUrl);
  return (
    <span
      className={`avatar${large ? " large" : ""}`}
      title={name}
      role="img"
      aria-label={`${name} — фото профиля`}
    >
      <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      {showPhoto && (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedPhoto(photoUrl ?? "")}
        />
      )}
    </span>
  );
}

export function Photo({
  photo,
  alt,
  className,
}: {
  photo: Blob;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(photo);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [photo]);
  return url ? (
    <img src={url} alt={alt} className={className} loading="lazy" />
  ) : null;
}

export function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close(): void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    node.showModal();
    return () => {
      node.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-heading">
          <h2 id="sheet-title">{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
