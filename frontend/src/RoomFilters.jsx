import {Select} from './Select';
import React, {useId, useRef, useState} from 'react';
import {roomDetails} from './roomDetails';
import {Icon} from './ui';

const types = Object.entries(roomDetails).map(([value, [label]]) => ({value, label}));

function RoomTypePicker({value, onChange}) {
  const [custom, setCustom] = useState(false);
  const customInput = useRef(null);
  const known = types.find(type => type.value === value);
  const isCustom = custom || Boolean(value && !known);

  return <div className="type-picker">
    <label>Категория
      <Select aria-label="Категория номера" value={isCustom ? '__custom__' : value} onChange={event => {
        if (event.target.value === '__custom__') {
          setCustom(true);
          if (!isCustom) onChange('');
          requestAnimationFrame(() => customInput.current?.focus());
        } else {
          setCustom(false);
          onChange(event.target.value);
        }
      }}>
        <option value="">Все категории</option>
        {types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        <option value="__custom__">Другая категория</option>
      </Select>
    </label>
    {isCustom && <label className="filter-custom">Название категории
      <input ref={customInput} value={value} maxLength={50} placeholder="Введите название"
        onChange={event => onChange(event.target.value)}/>
    </label>}
  </div>;
}

function PriceField({label, value, onChange}) {
  return <label>{label}
    <span className="price-field">
      <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="—" value={value}
        onChange={event => onChange(event.target.value)}/>
      <span aria-hidden="true">₸</span>
    </span>
  </label>;
}

export function RoomFilters({filters, setFilters, preferredRoom}) {
  const [open, setOpen] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const toggle = useRef(null);
  const id = useId();
  const update = (key, value) => setFilters(current => ({...current, [key]: value}));
  const active = Number(Boolean(!preferredRoom && filters.room_type)) + Number(Boolean(filters.min_price || filters.max_price));

  return <div className="stay-filters">
    <button type="button" className="filter-toggle" ref={toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span><Icon name="sliders" size={17}/> Фильтры номера{active > 0 && <span className="filter-count">{active}</span>}</span>
      <Icon name="down" size={16}/>
    </button>
    <div id={id} className="fold" data-open={open} inert={!open}>
      <div className="fold-content">
        <div className="filter-content">
          {!preferredRoom && <RoomTypePicker key={resetCount} value={filters.room_type} onChange={value => update('room_type', value)}/>}
          <fieldset className="price-filter">
            <legend>Цена за ночь</legend>
            <div className="price-filter-fields">
              <PriceField label="От" value={filters.min_price} onChange={value => update('min_price', value)}/>
              <PriceField label="До" value={filters.max_price} onChange={value => update('max_price', value)}/>
            </div>
          </fieldset>
          {active > 0 && <button type="button" className="filter-reset text-button" onClick={() => {
            setFilters(current => ({...current, room_type: '', min_price: '', max_price: ''}));
            setResetCount(count => count + 1);
            toggle.current?.focus();
          }}>Сбросить фильтры</button>}
        </div>
      </div>
    </div>
  </div>;
}
