import React, {Children, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './ui';
import './select.css';

export function Select({children, value, defaultValue, onChange, name, disabled, autoFocus, ...props}) {
  const options = Children.toArray(children).filter(Boolean).map(option => ({
    value: String(option.props.value ?? option.props.children), label: option.props.children, disabled: option.props.disabled,
  }));
  const [local, setLocal] = useState(defaultValue ?? options[0]?.value ?? '');
  const selected = String(value ?? local);
  const selectedIndex = options.findIndex(option => option.value === selected);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const search = useRef({text: '', time: 0});
  const id = useId();

  function close() {setOpen(false);}
  function show(index = selectedIndex) {
    if (trigger.current?.matches(':disabled')) return;
    const next = options[index]?.disabled ? -1 : index;
    setActive(next >= 0 ? next : options.findIndex(option => !option.disabled));
    setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled || trigger.current?.matches(':disabled')) return;
    setLocal(option.value);
    close();
    trigger.current?.focus();
    onChange?.({target: {name, value: option.value, type: 'select-one'}});
  }
  function move(step) {
    let next = active;
    for (let count = 0; count < options.length; count++) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) {setActive(next); break;}
    }
  }
  function keyDown(event) {
    if (event.key === 'Tab') {close(); return;}
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home') {show(options.findIndex(option => !option.disabled)); return;}
      if (event.key === 'End') {show(options.findLastIndex(option => !option.disabled)); return;}
      if (!open) {show(); return;}
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') move(event.key === 'ArrowDown' ? 1 : -1);
      else choose(active);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      search.current.text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase('ru');
      search.current.time = now;
      const index = options.findIndex(option => !option.disabled && String(option.label).toLocaleLowerCase('ru').startsWith(search.current.text));
      if (index >= 0) {show(index);}
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const upwards = below < 180 && above > below;
      const width = Math.min(Math.max(rect.width, 210), window.innerWidth - 24);
      setPosition({left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width,
        maxHeight: Math.max(48, Math.min(280, upwards ? above : below)),
        ...(upwards ? {bottom: window.innerHeight - rect.top + 6} : {top: rect.bottom + 6})});
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);};
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss);};
  }, [open]);
  useEffect(() => {if (disabled) close();}, [disabled]);
  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block: 'nearest'});
  }, [open, active, position]);

  return <span className="custom-select">
    {name && <input type="hidden" name={name} value={selected} disabled={disabled}/>}
    <button {...props} ref={trigger} autoFocus={autoFocus} type="button" className="custom-select-trigger" role="combobox"
      disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
      aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
      onKeyDown={keyDown} onClick={() => open ? close() : show()}>
      <span>{options[selectedIndex]?.label ?? 'Выберите значение'}</span><Icon name="down" size={16}/>
    </button>
    {open && position && createPortal(<div ref={menu} id={id} role="listbox" aria-label={props['aria-label'] || 'Варианты выбора'}
      className="custom-select-menu" style={position} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div id={`${id}-${index}`} key={option.value} role="option" aria-selected={selected === option.value}
        aria-disabled={option.disabled || undefined} className="custom-select-option" data-index={index} data-highlighted={active === index || undefined}
        onPointerMove={() => {if (!option.disabled) setActive(index);}} onClick={() => choose(index)}>
        <span>{option.label}</span>{selected === option.value && <Icon name="check" size={16}/>}
      </div>)}
    </div>, document.body)}
  </span>;
}
