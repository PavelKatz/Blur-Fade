import React from 'react';

interface Option {
    label: string;
    value: number;
}

interface EffectButtonsProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    options: Option[];
}

const EffectButtons: React.FC<EffectButtonsProps> = ({ label, value, onChange, options }) => {
    
    const handleClick = (optionValue: number) => {
        // If the clicked button is already active, set value to 0 (turn off),
        // otherwise, set it to the new value.
        onChange(value === optionValue ? 0 : optionValue);
    };

    return (
        <div className="p-2 space-y-2">
            <label className="text-sm font-medium text-gray-300 px-2">{label}</label>
            <div className="grid grid-cols-3 gap-2">
                {options.map((option) => (
                    <button
                        key={option.label}
                        onClick={() => handleClick(option.value)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-400 ${
                            value === option.value
                                ? 'bg-indigo-500/60 text-white shadow-md'
                                : 'bg-white/10 hover:bg-white/20 text-gray-200'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EffectButtons;
