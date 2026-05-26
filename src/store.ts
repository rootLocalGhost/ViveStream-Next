import { createSignal } from "solid-js";

// Check local storage for existing preference. Default to true (animated).
const storedAnimPref = localStorage.getItem("useAnimatedIcons");
const initialAnimState =
  storedAnimPref !== null ? storedAnimPref === "true" : true;

export const [useAnimatedIcons, setUseAnimatedIcons] =
  createSignal(initialAnimState);

export const toggleAnimatedIcons = (val: boolean) => {
  setUseAnimatedIcons(val);
  localStorage.setItem("useAnimatedIcons", val.toString());
};
