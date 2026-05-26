import { Component } from "solid-js";

const PremiumPlaceholder: Component<{
  title: string;
  subtitle: string;
  iconName: string;
}> = (props) => (
  <div class="placeholder-container">
    <div class="placeholder-icon-wrapper">
      <div class="placeholder-glow"></div>
      <i class={`ph-fill ph-${props.iconName}`}></i>
    </div>
    <h2 class="placeholder-title">{props.title}</h2>
    <p class="placeholder-subtitle">{props.subtitle}</p>
  </div>
);

export default PremiumPlaceholder;
