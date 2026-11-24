void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec4 terminal = texture(iChannel0, fragCoord / iResolution.xy);
    float brightness = iFocus > 0 ? 1.0 : 0.75;
    fragColor = vec4(terminal.rgb * brightness, terminal.a);
}
