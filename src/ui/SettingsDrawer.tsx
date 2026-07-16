import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Icon } from './Icons';
import { Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { usePhysicsConfig } from '../application/PhysicsConfigContext';
import { generateEngineConfigSource } from './generateEngineConfigSource';

interface SettingsDrawerProps {
  showBestOnly: boolean;
  onToggleBestOnly: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onVaultOpen: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = (componentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'physics': true
  });
  
  const toggleSection = (name: string) => {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const physicsConfig = usePhysicsConfig();
  
  // Merge physicsConfig into props object
  const props = { ...componentProps, ...physicsConfig };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) props.onLoad(file);
      if (e.target) e.target.value = '';
  };

  return (
    <>
        {/* TOP RIGHT CONTROLS */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            
            {/* Vault Trigger */}
            <button
                onClick={props.onVaultOpen}
                className="p-2 rounded-full bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-300 shadow-lg"
                title="Open Vault"
            >
                <Archive className="w-6 h-6" />
            </button>

            {/* Show Best Only Toggle */}
            <button
                onClick={props.onToggleBestOnly}
                className={`p-2 rounded-full transition-all duration-300 shadow-lg ${
                    props.showBestOnly 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                    : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Focus Champion"
            >
                {/* Reusing Eye icon, but maybe colored differently when active */}
                <Icon name="eye" className="w-6 h-6" />
            </button>

            {/* Settings Toggle */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-all duration-300 shadow-lg ${
                    isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Settings"
            >
                <Icon name="settings" className="w-6 h-6" />
            </button>
        </div>

        {/* Drawer Panel */}
        <div className={`absolute top-0 right-0 h-full w-80 bg-slate-900/95 backdrop-blur shadow-2xl border-l border-slate-800 transform transition-transform duration-300 ease-in-out z-40 p-6 overflow-y-auto ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
            <h2 className="text-xl font-bold text-white mb-6 mt-12">Settings</h2>

            {/* physics - mirrors ENGINE_CONFIG.physics: same section name, same
                field order, same internal subgroup comments, so a value read
                in EngineConfig.ts maps directly to a labeled control here. */}
            <Section title="physics" isOpen={!!expandedSections['physics']} onToggle={() => toggleSection('physics')}>
                <Slider label="gravity" value={props.gravity} min={0.0} max={2000.0} step={10.0} onChange={props.setGravity} color="accent-red-500" tooltip="Gravity Strength. Downward acceleration. High gravity keeps creatures grounded but crushes weak skeletons." />
                <Slider label="friction" value={props.friction} min={0.80} max={0.99} step={0.01} onChange={props.setFriction} color="accent-teal-500" tooltip="Air Resistance. Global damping factor. Lower values simulate thick atmosphere (drag)." />

                <SubSection title="Core Constraints">
                    <Slider label="maxVelocity" value={props.maxVelocity} min={5.0} max={100.0} step={1.0} onChange={props.setMaxVelocity} color="accent-red-600" tooltip="Max Speed. Simulation speed limit. Prevents 'nan' explosions by capping node velocity." />
                    {props.relaxationFactor !== undefined && props.setRelaxationFactor && (
                        <Slider label="relaxationFactor" value={props.relaxationFactor} min={0.01} max={1.0} step={0.01} onChange={props.setRelaxationFactor} color="accent-indigo-300" tooltip="Relaxation Factor. Jacobi relaxation for solver. Lowers explosive feedback in dense clumps." />
                    )}
                    {props.constraintIterations !== undefined && props.setConstraintIterations && (
                        <Slider label="iterations" value={props.constraintIterations} min={1} max={10} step={1} onChange={props.setConstraintIterations} color="accent-purple-600" tooltip="Constraint Loops (config key: iterations). PBD solver iterations per sub-step. Higher = stiffer springs but lowers FPS." />
                    )}
                </SubSection>

                <SubSection title="Damping & Resistance">
                    {props.baseMuscleDamping !== undefined && props.setBaseMuscleDamping && (
                        <Slider label="baseMuscleDamping" value={props.baseMuscleDamping} min={0.01} max={0.5} step={0.01} onChange={props.setBaseMuscleDamping} color="accent-pink-300" tooltip="Muscle Damping. Local damping to resist infinite spring oscillation." />
                    )}
                    <Slider label="rotationalDrag" value={props.rotationalDrag} min={0.0} max={2.0} step={0.01} onChange={props.setRotationalDrag} color="accent-yellow-500" tooltip="Stability (Gyro). Resistance to angular momentum. Helps creatures stay upright and not spin out of control." />
                </SubSection>

                <SubSection title="Realism & Stress">
                    <Slider label="maxGripStress" value={props.maxGripStress} min={1.0} max={100.0} step={1.0} onChange={props.setMaxGripStress} color="accent-orange-600" tooltip="Max Grip Force. How much force can a grip point handle before ripping off 'Stress Break'." />
                </SubSection>

                <SubSection title="Friction & Grip">
                    <Slider label="staticFrictionThreshold" value={props.staticFrictionThreshold} min={0.01} max={1.0} step={0.01} onChange={props.setStaticFrictionThreshold} color="accent-indigo-400" tooltip="Grip Threshold. Nodes must move slower than this to initiate a grip state." />
                    <Slider label="gripCooldown" value={props.gripCooldown} min={0} max={300} step={1} onChange={props.setGripCooldown} color="accent-slate-500" tooltip="Frames to wait after a grip break before capable of re-anchoring (60 = 1s)." />
                    {props.gripDepletion !== undefined && props.setGripDepletion && (
                        <Slider label="gripDepletionRate" value={props.gripDepletion} min={0.1} max={5.0} step={0.1} onChange={props.setGripDepletion} color="accent-orange-500" tooltip="Grip Stamina (Drain). Rate at which feet lose grip when stressed (leaning or pulling)." />
                    )}
                    {props.gripRecharge !== undefined && props.setGripRecharge && (
                        <Slider label="gripRechargeRate" value={props.gripRecharge} min={0.001} max={0.1} step={0.001} onChange={props.setGripRecharge} color="accent-lime-500" tooltip="Grip Recovery. Base rate of grip stamina regeneration when not under stress." />
                    )}
                </SubSection>

                <SubSection title="Muscle Limits">
                    <Slider label="slipFactor" value={props.slipFactor} min={0.0} max={1.0} step={0.01} onChange={props.setSlipFactor} color="accent-teal-400" tooltip="Slip Friction. Velocity preserved when sliding (0.0 = Instant stop, 1.0 = Ice)." />
                    <Slider label="brokenSlipFactor" value={props.brokenSlipFactor} min={0.0} max={1.0} step={0.01} onChange={props.setBrokenSlipFactor} color="accent-teal-600" tooltip="Stress Slip. Velocity preserved when grip breaks under stress (usually higher than normal slip)." />
                </SubSection>

                <SubSection title="Density">
                    {props.density !== undefined && props.setDensity && (
                        <Slider label="densityMultiplier" value={props.density} min={0.5} max={3.0} step={0.1} onChange={props.setDensity} color="accent-blue-400" tooltip="Creature Density. Global mass multiplier. Heavier creatures have more inertia but require more force to move." />
                    )}
                    {props.headMass !== undefined && props.setHeadMass && (
                        <Slider label="headMass" value={props.headMass} min={0.1} max={50.0} step={0.1} onChange={props.setHeadMass} color="accent-red-400" tooltip="Mass of HEAD nodes. High head mass creates a stable 'anchor' for the body to whip around." />
                    )}
                    {props.bodyMass !== undefined && props.setBodyMass && (
                        <Slider label="bodyMass" value={props.bodyMass} min={0.1} max={50.0} step={0.1} onChange={props.setBodyMass} color="accent-slate-400" tooltip="Mass of standard BODY nodes. Affects energy distribution and torso momentum." />
                    )}
                    {props.footMass !== undefined && props.setFootMass && (
                        <Slider label="footMass" value={props.footMass} min={0.1} max={50.0} step={0.1} onChange={props.setFootMass} color="accent-green-400" tooltip="Mass of FOOT nodes. Heavier feet can find more traction but take more energy to lift." />
                    )}
                </SubSection>

                <SubSection title="Structural">
                    {props.shapeMemory !== undefined && props.setShapeMemory && (
                        <Slider label="shapeMemoryStrength" value={props.shapeMemory} min={0.0} max={2.0} step={0.1} onChange={props.setShapeMemory} color="accent-indigo-500" tooltip="Structure Memory. How strongly cells try to return to their original rest-pose positions." />
                    )}
                    <Slider label="globalStiffness" value={props.globalStiffness} min={0.1} max={2.0} step={0.1} onChange={props.setGlobalStiffness} color="accent-blue-500" tooltip="Bone Stiffness. Restoring force of the skeleton. Higher values make the creature more rigid and bouncy." />
                    <Slider label="globalContractility" value={props.globalContractility} min={0.0} max={6.0} step={0.1} onChange={props.setGlobalContractility} color="accent-purple-500" tooltip="Muscle Power. Multiplier for neural signals. Controls how much force muscles apply when expanding/contracting." />
                </SubSection>
            </Section>

            {/* metabolism - mirrors ENGINE_CONFIG.metabolism */}
            <Section title="metabolism" isOpen={!!expandedSections['metabolism']} onToggle={() => toggleSection('metabolism')}>
                <Slider label="baseDecay" value={props.baseDecay} min={0.0} max={20.0} step={0.5} onChange={props.setBaseDecay} color="accent-orange-400" tooltip="Base Decay (Time)." />
                <Slider label="movementCost" value={props.movementCost} min={0.0} max={5.0} step={0.1} onChange={props.setMovementCost} color="accent-red-400" tooltip="Movement Cost." />
                <Slider label="foodEnergy" value={props.foodEnergy} min={5} max={100} step={5} onChange={props.setFoodEnergy} color="accent-green-400" tooltip="Food Energy." />
                <Slider label="groundContactMetabolismMultiplier" value={props.groundContactMetabolismMultiplier} min={1.0} max={5.0} step={0.1} onChange={props.setGroundContactMetabolismMultiplier} color="accent-amber-600" tooltip="Grounded Penalty. Multiplier for metabolic drain when a body cell touches the ground. 1.0 = no extra cost, 1.5 = 50% increase." />

                <SubSection title="Family Traits">
                    {props.setRedBasalMultiplier && (
                        <Slider
                            label="redBasalMultiplier"
                            value={props.redBasalMultiplier || 3.0}
                            min={0.1} max={10.0} step={0.1}
                            onChange={props.setRedBasalMultiplier}
                            color="accent-red-500"
                            tooltip="Red (Brute) Drain Multiplier. Multiplies passive energy drain. Red bots burn calories just by existing, forcing them to sprint and take risks before they starve."
                        />
                    )}
                    {props.setBlueMovementMultiplier && (
                        <Slider
                            label="blueMovementMultiplier"
                            value={props.blueMovementMultiplier || 0.1}
                            min={0.1} max={2.0} step={0.1}
                            onChange={props.setBlueMovementMultiplier}
                            color="accent-blue-500"
                            tooltip="Blue (Monolith) Cost Multiplier. Multiplies the energy cost of moving. Blue bots use fewer calories to move, allowing them to rely on thick armor and slow steps."
                        />
                    )}
                    {props.setGreenMovementMultiplier && (
                        <Slider
                            label="greenMovementMultiplier"
                            value={props.greenMovementMultiplier || 3.0}
                            min={0.1} max={10.0} step={0.1}
                            onChange={props.setGreenMovementMultiplier}
                            color="accent-green-500"
                            tooltip="Green (Scout) Cost Multiplier. Multiplies the energy cost of moving. Green bots must find the most efficient gate to avoid wasting batteries on unnecessary flailing."
                        />
                    )}
                </SubSection>
            </Section>

            {/* ecosystem - mirrors ENGINE_CONFIG.ecosystem */}
            <Section title="ecosystem" isOpen={!!expandedSections['ecosystem']} onToggle={() => toggleSection('ecosystem')}>
                <Slider label="foodSpawnCount" value={props.foodSpawnCount} min={10} max={100} step={1} onChange={props.setFoodSpawnCount} color="accent-yellow-500" tooltip="Food Count." />
                <Slider label="foodSpawnRadius" value={props.foodSpawnRadius} min={2.0} max={10.0} step={0.5} onChange={props.setFoodSpawnRadius} color="accent-orange-500" tooltip="Spawn Radius." />
                <Slider label="foodSpawnMinHeight" value={props.foodSpawnMinHeight} min={0.1} max={5.0} step={0.1} onChange={props.setFoodSpawnMinHeight} color="accent-lime-500" tooltip="Food Height Range - Min." />
                <Slider label="foodSpawnMaxHeight" value={props.foodSpawnMaxHeight} min={0.1} max={10.0} step={0.1} onChange={props.setFoodSpawnMaxHeight} color="accent-lime-500" tooltip="Food Height Range - Max." />
                <Slider label="interactionRadius" value={props.interactionRadius} min={0.2} max={2.0} step={0.1} onChange={props.setInteractionRadius} color="accent-pink-500" tooltip="Interaction Radius. Consolidated radius for eating and food magnet interaction." />

                <div className="mt-2 pt-2 border-t border-slate-800/50">
                    <Slider label="breedingThreshold" value={props.breedingThreshold} min={1} max={20} step={1} onChange={props.setBreedingThreshold} color="accent-pink-500" tooltip="Breeding Threshold (Food). Foods needed to trigger an asexual breeding event." />
                </div>

                <Slider label="foodSpreadFactor" value={props.foodSpreadFactor} min={0} max={1.0} step={0.05} onChange={props.setFoodSpreadFactor} color="accent-yellow-600" tooltip="Food Spread Factor. 0: Completely random, 1: Perfectly equidistant." />
            </Section>

            {/* neural - mirrors ENGINE_CONFIG.neural (only visionRadius is exposed) */}
            <Section title="neural" isOpen={!!expandedSections['neural']} onToggle={() => toggleSection('neural')}>
                <Slider label="visionRadius" value={props.visionRadius} min={1.0} max={10.0} step={0.5} onChange={props.setVisionRadius} color="accent-teal-500" tooltip="Vision Range." />
            </Section>

            {/* evolution - mirrors ENGINE_CONFIG.evolution */}
            <Section title="evolution" isOpen={!!expandedSections['evolution']} onToggle={() => toggleSection('evolution')}>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <Slider
                        label="populationSize"
                        value={props.populationSize}
                        min={10}
                        max={100}
                        step={10}
                        onChange={props.setPopulationSize}
                        color="accent-purple-500"
                        tooltip="Simulation Scale (Batches)."
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                        <span>Min: 1 Batch (10 bots)</span>
                        <span>Max: 10 Batches (100 bots)</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <Slider
                        label="vaultSaveFrequency"
                        value={props.vaultSaveFrequency}
                        min={1}
                        max={10}
                        step={1}
                        onChange={props.setVaultSaveFrequency}
                        color="accent-cyan-500"
                        tooltip="Auto-Save Interval."
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Archives champions every {props.vaultSaveFrequency} generation{props.vaultSaveFrequency > 1 ? 's' : ''}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-4">
                    <Slider label="odometryScale" value={props.odometryScale} min={0} max={20} step={1} onChange={props.setOdometryScale} color="accent-blue-500" tooltip="Odometry Weight. Reward for raw distance traveled away from the origin in the Z-axis." />
                    <Slider label="territoryScale" value={props.territoryScale} min={0} max={200} step={5} onChange={props.setTerritoryScale} color="accent-teal-500" tooltip="Territory Weight. Bonus for exploring 'novel' regions of the simulation floor." />
                    <Slider label="foodScoreIncrement" value={props.foodScoreIncrement} min={0} max={50} step={1} onChange={props.setFoodScoreIncrement} color="accent-green-500" tooltip="Food Reward (Inc). Sets the points for the first food. Each subsequent food increases the reward by this same amount (exponential reward structure)." />
                </div>
            </Section>

            {/* Display - UI-only view toggles; no ENGINE_CONFIG source */}
            <Section title="Display (UI only)" isOpen={!!expandedSections['Display (UI only)']} onToggle={() => toggleSection('Display (UI only)')}>
                <Toggle label="Show Vision Radius" active={props.showVision} onClick={() => props.setShowVision(!props.showVision)} />
                <Toggle label="Show Mouth Sphere" active={props.showMouth} onClick={() => props.setShowMouth(!props.showMouth)} />
            </Section>

            {/* IO Section */}
            <Section title="Data" isOpen={!!expandedSections['Data']} onToggle={() => toggleSection('Data')}>
                 <div className="flex gap-2">
                    <button onClick={props.onSave} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-xs font-bold text-cyan-400">
                        SAVE CREATURE
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-xs font-bold text-yellow-400">
                        LOAD CREATURE
                    </button>
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="application/json" onChange={handleFileChange} />

                 <button
                    onClick={async () => {
                        const source = generateEngineConfigSource(props);
                        await navigator.clipboard.writeText(source);
                        toast.success('EngineConfig.ts copied - paste over the file to make it permanent.');
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-xs font-bold text-emerald-400"
                    title="Copies EngineConfig.ts's exact source, with every slider above baked in as the new default"
                 >
                    COPY EngineConfig.ts
                 </button>
            </Section>

             <div className="mt-8 text-xs text-slate-600 text-center">
                 Project Origami v0.6
             </div>
        </div>
    </>
  );
};

const Section: React.FC<{ title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode }> = ({ title, isOpen, onToggle, children }) => (
    <div className="mb-4">
        <button 
            onClick={onToggle}
            className="flex items-center justify-between w-full pb-2 border-b border-slate-800 text-left group"
        >
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">{title}</h3>
            {isOpen ? <ChevronUp className="w-4 h-4 text-slate-600 group-hover:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />}
        </button>
        {isOpen && (
            <div className="space-y-4 pt-4 pb-2 content-anim">
                {children}
            </div>
        )}
    </div>
);

const Toggle: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
    <button 
        onClick={onClick}
        className="flex items-center justify-between w-full group"
    >
        <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
        <div className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${active ? 'bg-blue-600' : 'bg-slate-700'}`}>
            <div className={`absolute top-1 left-1 w-2 h-2 rounded-full bg-white transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
    </button>
);

const Slider: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, color: string, tooltip?: string }> = ({
    label, value, min, max, step, onChange, color, tooltip
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value.toString());

    // Sync input value when external value changes (not editing)
    useEffect(() => {
        if (!isEditing) setInputValue(value.toString());
    }, [value, isEditing]);

    const handleInputBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(inputValue);
        if (!isNaN(parsed)) {
            // clamp value
            const clamped = Math.max(min, Math.min(max, parsed));
            onChange(clamped);
            setInputValue(clamped.toString());
        } else {
            setInputValue(value.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="group relative">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span>{label}</span>
                {isEditing ? (
                    <input 
                        type="number"
                        className="w-16 bg-slate-800 text-slate-200 font-mono text-right rounded px-1 min-h-[20px] outline-none focus:ring-1 focus:ring-slate-500"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleInputBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                ) : (
                    <span 
                        className="font-mono text-slate-200 cursor-text hover:bg-slate-800 px-1 rounded transition-colors min-h-[20px]"
                        onClick={() => setIsEditing(true)}
                        title="Click to edit"
                    >
                        {value}
                    </span>
                )}
            </div>
            <input 
                type="range" min={min} max={max} step={step} 
                value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer ${color}`}
            />
            {tooltip && (
                <div className="opacity-0 group-hover:opacity-100 absolute z-[100] bottom-full left-0 mb-3 w-64 p-3 bg-slate-900 border border-slate-700/50 rounded-lg text-[11px] text-slate-300 shadow-2xl pointer-events-none transition-all duration-200 translate-y-2 group-hover:translate-y-0 backdrop-blur-md">
                    <div className="font-bold text-slate-100 mb-1 border-b border-white/5 pb-1 uppercase tracking-tighter text-[9px]">Insight</div>
                    {tooltip}
                </div>
            )}
        </div>
    );
};

const SubSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50 mt-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase">{title}</span>
        {children}
    </div>
);