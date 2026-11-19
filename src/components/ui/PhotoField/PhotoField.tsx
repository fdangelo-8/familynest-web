"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  PHOTO_ACCEPT,
  PHOTO_CHANGE_LABEL,
  PHOTO_FIELD_HELP,
  PHOTO_FIELD_LABEL,
  PHOTO_PICK_LABEL,
  PHOTO_REMOVE_LABEL,
  PHOTO_TYPES,
  PHOTO_TYPE_ERROR,
} from "@/lib/photo-field-texts";
import { Avatar, type MemberColor } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { Skeleton } from "../Skeleton/Skeleton";

export type PhotoFieldProps = {
  /** Name of the person or animal: initial of the avatar and name of the photo */
  name: string;
  color: MemberColor;
  /** The photo already saved, if any (shown until another is chosen or removed) */
  photoSrc?: string;
  /**
   * A file of an allowed type was chosen; the preview is already on screen.
   * The component does not upload or resize: the server reduces the copy.
   */
  onPick: (file: File) => void;
  /** «Togli la foto» was pressed */
  onRemove: () => void;
  /** The page is reducing the chosen photo: skeleton and button in loading */
  reducing?: boolean;
  /**
   * Error text from the page (for example the photo could not be reduced).
   * When it arrives the preview of the chosen file is dropped: the saved photo
   * or the initial is shown again. The page clears it on the next `onPick`.
   */
  error?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * «Foto»: avatar (or photo) at 72 px with «Scegli una foto» / «Cambia la foto»
 * and «Togli la foto». It handles the choice of the file and the preview only.
 */
export function PhotoField({
  name,
  color,
  photoSrc,
  onPick,
  onRemove,
  reducing = false,
  error,
  disabled,
  className,
  "data-testid": testId,
}: PhotoFieldProps) {
  const id = useId();
  const labelId = `${id}-etichetta`;
  const helpId = `${id}-aiuto`;
  const errorId = `${id}-errore`;
  const inputRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const focusPick = useRef(false);
  // `undefined`: nothing chosen here; `null`: the photo was removed here.
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [typeError, setTypeError] = useState(false);

  // The page could not use the chosen photo (`error` arrives): the preview
  // goes back to what it was, the saved photo or the initial.
  const [seenError, setSeenError] = useState(error);
  if (error !== seenError) {
    setSeenError(error);
    if (error && typeof preview === "string") setPreview(undefined);
  }

  const shown = preview === null ? undefined : (preview ?? photoSrc);
  const message = error ?? (typeError ? PHOTO_TYPE_ERROR : undefined);

  // Object addresses are released when replaced or when the field goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // After «Togli la foto» the button is gone: the focus goes to «Scegli una foto».
  useEffect(() => {
    if (focusPick.current && !shown) {
      focusPick.current = false;
      pickRef.current?.focus();
    }
  }, [shown]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setTypeError(true);
      return;
    }
    setTypeError(false);
    setPreview(URL.createObjectURL(file));
    onPick(file);
  }

  function handleRemove() {
    focusPick.current = true;
    setTypeError(false);
    setPreview(null);
    onRemove();
  }

  return (
    <div
      className={cx("campo", message && "campo--errore", className)}
      data-testid={testId}
    >
      <span className="campo__etichetta" id={labelId}>
        {PHOTO_FIELD_LABEL}
      </span>
      <div className="campo-foto">
        {reducing ? (
          <Skeleton shape="cerchio" />
        ) : (
          <Avatar
            name={name}
            color={color}
            size="xl"
            photoSrc={shown}
            photoAlt={`Foto di ${name}`}
          />
        )}
        <div className="campo-foto__azioni">
          <Button
            variant="secondary"
            small
            loading={reducing}
            disabled={disabled}
            buttonRef={pickRef}
            aria-describedby={cx(helpId, message && errorId)}
            onClick={() => inputRef.current?.click()}
          >
            {shown ? PHOTO_CHANGE_LABEL : PHOTO_PICK_LABEL}
          </Button>
          {shown ? (
            <Button
              variant="link-secondario"
              disabled={disabled || reducing}
              onClick={handleRemove}
            >
              {PHOTO_REMOVE_LABEL}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="campo__aiuto" id={helpId}>
        {PHOTO_FIELD_HELP}
      </p>
      {message ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {message}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        className="visivamente-nascosto"
        accept={PHOTO_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  );
}
