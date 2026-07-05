import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { usePhysicsConfig } from '../application/PhysicsConfigContext';

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
    'Fitness Scoring': true
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

            {/* Physics Section */}
            <Section title="Physics Engine" isOpen={!!expandedSections['Physics Engine']} onToggle={() => toggleSection('Physics Engine')}>
                <Slider label="Bone Stiffness" value={props.globalStiffness} min={0.1} max={2.0} step={0.1} onChange={props.setGlobalStiffness} color="accent-blue-500" tooltip="Restoring force of the skeleton. Higher values make the creature more rigid and bouncy." />
                <Slider label="Muscle Power" value={props.globalContractility} min={0.0} max={6.0} step={0.1} onChange={props.setGlobalContractility} color="accent-purple-500" tooltip="Multiplier for neural signals. Controls how much force muscles apply when expanding/contracting." />
                {props.shapeMemory !== undefined && props.setShapeMemory && (
                     <Slider label="Structure Memory" value={props.shapeMemory} min={0.0} max={2.0} step={0.1} onChange={props.setShapeMemory} color="accent-indigo-500" tooltip="How strongly cells try to return to their original rest-pose positions." />
                )}
                {props.density !== undefined && props.setDensity && (
                     <Slider label="Creature Density" value={props.density} min={0.5} max={3.0} step={0.1} onChange={props.setDensity} color="accent-blue-400" tooltip="Global mass multiplier. Heavier creatures have more inertia but require more force to move." />
                )}
                
                <SubSection title="Individual Cell Masses">
                    {props.headMass !== undefined && props.setHeadMass && (
                        <Slider label="Head Node Mass" value={props.headMass} min={0.1} max={50.0} step={0.1} onChange={props.setHeadMass} color="accent-red-400" tooltip="Mass of HEAD nodes. High head mass creates a stable 'anchor' for the body to whip around." />
                    )}
                    {props.bodyMass !== undefined && props.setBodyMass && (
                        <Slider label="Body Node Mass" value={props.bodyMass} min={0.1} max={50.0} step={0.1} onChange={props.setBodyMass} color="accent-slate-400" tooltip="Mass of standard BODY nodes. Affects energy distribution and torso momentum." />
                    )}
                    {props.footMass !== undefined && props.setFootMass && (
                        <Slider label="Foot Node Mass" value={props.footMass} min={0.1} max={50.0} step={0.1} onChange={props.setFootMass} color="accent-green-400" tooltip="Mass of FOOT nodes. Heavier feet can find more traction but take more energy to lift." />
                    )}
                </SubSection>
            </Section>

            {/* NEW: World Forces */}
            <Section title="World Forces" isOpen={!!expandedSections['World Forces']} onToggle={() => toggleSection('World Forces')}>
                <Slider label="Gravity Strength" value={props.gravity} min={0.0} max={2000.0} step={10.0} onChange={props.setGravity} color="accent-red-500" tooltip="Downward acceleration. High gravity keeps creatures grounded but crushes weak skeletons." />
                <Slider label="Air Resistance" value={props.friction} min={0.80} max={0.99} step={0.01} onChange={props.setFriction} color="accent-teal-500" tooltip="Global damping factor. Lower values simulate thick atmosphere (drag)." />
                <Slider label="Stability (Gyro)" value={props.rotationalDrag} min={0.0} max={2.0} step={0.01} onChange={props.setRotationalDrag} color="accent-yellow-500" tooltip="Resistance to angular momentum. Helps creatures stay upright and not spin out of control." />
                
                {props.gripDepletion !== undefined && props.setGripDepletion && (
                    <Slider label="Grip Stamina (Drain)" value={props.gripDepletion} min={0.1} max={5.0} step={0.1} onChange={props.setGripDepletion} color="accent-orange-500" tooltip="Rate at which feet lose grip when stressed (leaning or pulling)." />
                )}
                {props.gripRecharge !== undefined && props.setGripRecharge && (
                    <Slider label="Grip Recovery" value={props.gripRecharge} min={0.001} max={0.1} step={0.001} onChange={props.setGripRecharge} color="accent-lime-500" tooltip="Base rate of grip stamina regeneration when not under stress." />
                )}

                <SubSection title="Advanced Simulation Tuning">
                    <Slider label="Max Speed" value={props.maxVelocity} min={5.0} max={100.0} step={1.0} onChange={props.setMaxVelocity} color="accent-red-600" tooltip="Simulation speed limit. Prevents 'nan' explosions by capping node velocity." />
                    
                    {props.terminalVelocity !== undefined && props.setTerminalVelocity && (
                        <Slider label="Terminal Velocity" value={props.terminalVelocity} min={10.0} max={200.0} step={1.0} onChange={props.setTerminalVelocity} color="accent-red-400" tooltip="Fallback limit on overall acceleration per frame." />
                    )}
                    {props.globalDamping !== undefined && props.setGlobalDamping && (
                        <Slider label="Global Damping" value={props.globalDamping} min={0.8} max={1.0} step={0.01} onChange={props.setGlobalDamping} color="accent-slate-400" tooltip="Additional velocity retention. 1.0 = none." />
                    )}
                    {props.baseMuscleDamping !== undefined && props.setBaseMuscleDamping && (
                        <Slider label="Muscle Damping" value={props.baseMuscleDamping} min={0.01} max={0.5} step={0.01} onChange={props.setBaseMuscleDamping} color="accent-pink-300" tooltip="Local damping to resist infinite spring oscillation." />
                    )}
                    {props.constraintIterations !== undefined && props.setConstraintIterations && (
                        <Slider label="Constraint Loops" value={props.constraintIterations} min={1} max={10} step={1} onChange={props.setConstraintIterations} color="accent-purple-600" tooltip="GPU PBD Iterations. Higher = stiffer springs but lowers FPS." />
                    )}
                    {props.relaxationFactor !== undefined && props.setRelaxationFactor && (
                        <Slider label="Relaxation Factor" value={props.relaxationFactor} min={0.01} max={1.0} step={0.01} onChange={props.setRelaxationFactor} color="accent-indigo-300" tooltip="Jacobi relaxation for solver. Lowers explosive feedback in dense clumps." />
                    )}
                    {props.contractionSpeed !== undefined && props.setContractionSpeed && (
                        <Slider label="Contraction Slew" value={props.contractionSpeed} min={1.0} max={20.0} step={0.1} onChange={props.setContractionSpeed} color="accent-orange-400" tooltip="How fast the muscle can alter its target length. Prevents instant-snap." />
                    )}
                    {props.antiSingularityRadius !== undefined && props.setAntiSingularityRadius && (
                        <Slider label="Repulsion Radius" value={props.antiSingularityRadius} min={0.01} max={0.2} step={0.01} onChange={props.setAntiSingularityRadius} color="accent-teal-300" tooltip="Triggers emergency repulsion when nodes perfectly overlap." />
                    )}

                    <Slider label="Grip Threshold" value={props.staticFrictionThreshold} min={0.01} max={1.0} step={0.01} onChange={props.setStaticFrictionThreshold} color="accent-indigo-400" tooltip="Nodes must move slower than this to initiate a grip state." />
                    <Slider label="Max Grip Force" value={props.maxGripStress} min={1.0} max={100.0} step={1.0} onChange={props.setMaxGripStress} color="accent-orange-600" tooltip="How much force can a grip point handle before ripping off 'Stress Break'." />
                    <Slider label="Grip Cooldown" value={props.gripCooldown} min={0} max={300} step={1} onChange={props.setGripCooldown} color="accent-slate-500" tooltip="Frames to wait after a grip break before capable of re-anchoring (60 = 1s)." />
                    <Slider label="Slip Friction" value={props.slipFactor} min={0.0} max={1.0} step={0.01} onChange={props.setSlipFactor} color="accent-teal-400" tooltip="Velocity preserved when sliding (0.0 = Instant stop, 1.0 = Ice)." />
                    <Slider label="Stress Slip" value={props.brokenSlipFactor} min={0.0} max={1.0} step={0.01} onChange={props.setBrokenSlipFactor} color="accent-teal-600" tooltip="Velocity preserved when grip breaks under stress (usually higher than normal slip)." />
                </SubSection>

                <SubSection title="Locomotor Dynamics">
                    <Slider label="Muscle Limit" value={props.muscleSignalLimit} min={0.05} max={0.8} step={0.01} onChange={props.setMuscleSignalLimit} color="accent-pink-400" tooltip="Cap for neural contraction/expansion signal (0.3 = 30% length change)." />
                    <Slider label="Muscle Softness" value={props.muscleSoftness} min={0.001} max={0.5} step={0.001} onChange={props.setMuscleSoftness} color="accent-pink-600" tooltip="Smoothing factor for muscle targets. Lower is more fluid/organic, higher is jittery/stiff." />
                    
                    {props.maxYieldRatio !== undefined && props.setMaxYieldRatio && (
                        <Slider label="Max Yield Drop" value={props.maxYieldRatio} min={1.0} max={3.0} step={0.05} onChange={props.setMaxYieldRatio} color="accent-teal-400" tooltip="Max stretch limit before muscles refuse to extend." />
                    )}
                    
                    <Slider label="Spinal Wave Freq" value={props.waveFreq} min={0.1} max={5.0} step={0.1} onChange={props.setWaveFreq} color="accent-cyan-400" tooltip="Base frequency of the hardcoded locomotor spine (CPG)." />
                    <Slider label="Spinal Wave Amp" value={props.waveAmp} min={0.0} max={0.5} step={0.01} onChange={props.setWaveAmp} color="accent-cyan-600" tooltip="Magnitude of the forced spinal expansion wave." />
                </SubSection>
            </Section>

            {/* Environment Section */}
            <Section title="Environment" isOpen={!!expandedSections['Environment']} onToggle={() => toggleSection('Environment')}>
                <Slider label="Food Count" value={props.foodSpawnCount} min={10} max={100} step={1} onChange={props.setFoodSpawnCount} color="accent-yellow-500" />
                <Slider label="Food Spread Factor" value={props.foodSpreadFactor} min={0} max={1.0} step={0.05} onChange={props.setFoodSpreadFactor} color="accent-yellow-600" tooltip="0: Completely random, 1: Perfectly equidistant." />
                <Slider label="Spawn Radius" value={props.foodSpawnRadius} min={2.0} max={10.0} step={0.5} onChange={props.setFoodSpawnRadius} color="accent-orange-500" />
                <SubSection title="Food Height Range">
                    <Slider label="Min Height" value={props.foodSpawnMinHeight} min={0.1} max={5.0} step={0.1} onChange={props.setFoodSpawnMinHeight} color="accent-lime-500" />
                    <Slider label="Max Height" value={props.foodSpawnMaxHeight} min={0.1} max={10.0} step={0.1} onChange={props.setFoodSpawnMaxHeight} color="accent-lime-500" />
                </SubSection>
                <Slider label="Vision Range" value={props.visionRadius} min={1.0} max={10.0} step={0.5} onChange={props.setVisionRadius} color="accent-teal-500" />
                <Slider label="Interaction Radius" value={props.interactionRadius} min={0.2} max={2.0} step={0.1} onChange={props.setInteractionRadius} color="accent-pink-500" tooltip="Consolidated radius for eating and food magnet interaction." />
                
                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-800/50">
                    <Toggle label="Show Vision Radius" active={props.showVision} onClick={() => props.setShowVision(!props.showVision)} />
                    <Toggle label="Show Mouth Sphere" active={props.showMouth} onClick={() => props.setShowMouth(!props.showMouth)} />
                </div>
            </Section>

            {/* Metabolism Section */}
            <Section title="Metabolism & Survival" isOpen={!!expandedSections['Metabolism & Survival']} onToggle={() => toggleSection('Metabolism & Survival')}>
                <Slider label="Base Decay (Time)" value={props.baseDecay} min={0.0} max={20.0} step={0.5} onChange={props.setBaseDecay} color="accent-orange-400" />
                <Slider label="Movement Cost" value={props.movementCost} min={0.0} max={5.0} step={0.1} onChange={props.setMovementCost} color="accent-red-400" />
                <Slider label="Grounded Penalty" value={props.groundContactMetabolismMultiplier} min={1.0} max={5.0} step={0.1} onChange={props.setGroundContactMetabolismMultiplier} color="accent-amber-600" tooltip="Multiplier for metabolic drain when a body cell touches the ground. 1.0 = no extra cost, 1.5 = 50% increase." />
                <Slider label="Food Energy" value={props.foodEnergy} min={5} max={100} step={5} onChange={props.setFoodEnergy} color="accent-green-400" />
                
                <SubSection title="Family Specific Traits">
                    {props.setRedBasalMultiplier && (
                        <Slider 
                            label="Red (Brute) Drain Multiplier" 
                            value={props.redBasalMultiplier || 3.0} 
                            min={0.1} max={10.0} step={0.1} 
                            onChange={props.setRedBasalMultiplier} 
                            color="accent-red-500" 
                            tooltip="Multiplies passive energy drain. Red bots burn calories just by existing, forcing them to sprint and take risks before they starve."
                        />
                    )}
                    {props.setBlueMovementMultiplier && (
                        <Slider 
                            label="Blue (Monolith) Cost Multiplier" 
                            value={props.blueMovementMultiplier || 0.1} 
                            min={0.1} max={2.0} step={0.1} 
                            onChange={props.setBlueMovementMultiplier} 
                            color="accent-blue-500" 
                            tooltip="Multiplies the energy cost of moving. Blue bots use fewer calories to move, allowing them to rely on thick armor and slow steps."
                        />
                    )}
                    {props.setGreenMovementMultiplier && (
                        <Slider 
                            label="Green (Scout) Cost Multiplier" 
                            value={props.greenMovementMultiplier || 3.0} 
                            min={0.1} max={10.0} step={0.1} 
                            onChange={props.setGreenMovementMultiplier} 
                            color="accent-green-500" 
                            tooltip="Multiplies the energy cost of moving. Green bots must find the most efficient gate to avoid wasting batteries on unnecessary flailing."
                        />
                    )}
                </SubSection>
            </Section>

            {/* Evolution Section */}
            <Section title="Evolution" isOpen={!!expandedSections['Evolution']} onToggle={() => toggleSection('Evolution')}>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <Slider 
                        label="Simulation Scale (Batches)" 
                        value={props.populationSize} 
                        min={10} 
                        max={100} 
                        step={10} 
                        onChange={props.setPopulationSize} 
                        color="accent-purple-500" 
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                        <span>Min: 1 Batch (10 bots)</span>
                        <span>Max: 10 Batches (100 bots)</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <Slider 
                        label="Auto-Save Interval" 
                        value={props.vaultSaveFrequency} 
                        min={1} 
                        max={10} 
                        step={1} 
                        onChange={props.setVaultSaveFrequency} 
                        color="accent-cyan-500" 
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Archives champions every {props.vaultSaveFrequency} generation{props.vaultSaveFrequency > 1 ? 's' : ''}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <Slider 
                        label="Breeding Threshold (Food)" 
                        value={props.breedingThreshold} 
                        min={1} 
                        max={20} 
                        step={1} 
                        onChange={props.setBreedingThreshold} 
                        color="accent-pink-500" 
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Foods needed to trigger an asexual breeding event
                    </div>
                </div>
            </Section>

            <Section title="Fitness Scoring" isOpen={!!expandedSections['Fitness Scoring']} onToggle={() => toggleSection('Fitness Scoring')}>
                <Slider label="Odometry Weight" value={props.odometryScale} min={0} max={20} step={1} onChange={props.setOdometryScale} color="accent-blue-500" tooltip="Reward for raw distance traveled away from the origin in the Z-axis." />
                <Slider label="Territory Weight" value={props.territoryScale} min={0} max={200} step={5} onChange={props.setTerritoryScale} color="accent-teal-500" tooltip="Bonus for exploring 'novel' regions of the simulation floor." />
                <Slider label="Food Reward (Inc)" value={props.foodScoreIncrement} min={0} max={50} step={1} onChange={props.setFoodScoreIncrement} color="accent-green-500" tooltip="Sets the points for the first food. Each subsequent food increases the reward by this same amount (exponential reward structure)." />
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