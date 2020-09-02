import { CommonComponentProps } from "./common";
import React, { useState, useEffect } from "react";
import styled from "styled-components";

type OptionProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
};

type Align = "horizontal" | "vertical" | "column" | "row";

type RadioProps = CommonComponentProps & {
  align?: Align;
  columns?: number;
  rows?: number;
  defaultValue: string;
  onSelect?: (value: string) => void;
  options: OptionProps[];
};

const RadioGroup = styled.div<{
  align?: Align;
}>`
  display: flex;
  flex-wrap: wrap;
  ${props =>
    props.align === "vertical" || props.align === "row"
      ? `
      flex-direction: column;
      height: 100%;
      `
      : null};
`;

const Radio = styled.label<{
  disabled?: boolean;
  align?: Align;
  columns?: number;
  rows?: number;
}>`
  display: block;
  position: relative;
  padding-left: ${props => props.theme.spaces[12] - 2}px;
  cursor: ${props => (props.disabled ? "not-allowed" : "pointer")};
  font-size: ${props => props.theme.typography.p1.fontSize}px;
  font-weight: ${props => props.theme.typography.p1.fontWeight};
  line-height: ${props => props.theme.typography.p1.lineHeight}px;
  letter-spacing: ${props => props.theme.typography.p1.letterSpacing}px;
  color: ${props => props.theme.colors.blackShades[9]};
  ${props =>
    props.align === "row" ? `flex-basis: calc(100% / ${props.rows})` : null};
  ${props =>
    props.align === "column"
      ? `flex-basis: calc(100% / ${props.columns})`
      : null};
  ${props =>
    props.align === "horizontal"
      ? `margin-right: ${props.theme.spaces[11] + 1}px`
      : null};
  ${props =>
    props.align === "vertical" || props.align === "column"
      ? `margin-bottom: ${props.theme.spaces[11] + 1}px`
      : `margin-bottom: ${props.theme.spaces[0]}px`};

  input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .checkbox {
    position: absolute;
    top: 0;
    left: 0;
    width: ${props => props.theme.spaces[8]}px;
    height: ${props => props.theme.spaces[8]}px;
    background-color: transparent;
    border: ${props => props.theme.spaces[1] - 2}px solid
      ${props => props.theme.colors.blackShades[4]};
    border-radius: 50%;
    margin-top: ${props => props.theme.spaces[0]}px;
  }

  .checkbox:after {
    content: "";
    position: absolute;
    display: none;
  }

  input:checked ~ .checkbox:after {
    display: block;
  }

  input:disabled ~ .checkbox:after {
    background-color: ${props => props.theme.colors.disabled};
  }

  .checkbox:after {
    content: "";
    position: absolute;
    width: ${props => props.theme.spaces[4]}px;
    height: ${props => props.theme.spaces[4]}px;
    ${props =>
      props.disabled
        ? `background-color: ${props.theme.colors.disabled}`
        : `background-color: ${props.theme.colors.info.main};`};
    top: ${props => props.theme.spaces[1] - 2}px;
    left: ${props => props.theme.spaces[1] - 2}px;
    border-radius: 50%;
  }
`;

export default function RadioComponent(props: RadioProps) {
  const [selected, setSelected] = useState(props.defaultValue);

  useEffect(() => {
    setSelected(props.defaultValue);
  }, [props.defaultValue]);

  const onChangeHandler = (value: string) => {
    setSelected(value);
    props.onSelect && props.onSelect(value);
  };

  return (
    <RadioGroup
      align={props.align}
      onChange={(e: any) => onChangeHandler(e.target.value)}
    >
      {props.options.map((option: OptionProps, index: number) => (
        <Radio
          key={index}
          align={props.align}
          columns={props.columns}
          rows={props.rows}
          disabled={props.disabled || option.disabled}
        >
          {option.label}
          <input
            type="radio"
            value={option.value}
            disabled={props.disabled || option.disabled}
            onChange={e => option.onSelect && option.onSelect(e.target.value)}
            checked={selected === option.value}
            name="radio"
          />
          <span className="checkbox"></span>
        </Radio>
      ))}
    </RadioGroup>
  );
}
