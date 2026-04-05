

const snippet2 = `
<span class="com">/**
 * =========================================================================================================================
 * NEURAL-QUANTUM HYBRID TESSELLATION ENGINE v7.4.1-alpha (Codename: "Oppenheimer") - CONFIDENTIAL & PROPRIETARY
 * =========================================================================================================================
 * This module is responsible for computing real-time wave-function collapse probabilities across a hyper-threaded GPU pipeline.
 * Warning: Do not modify synchronization constants unless bypassing the asynchronous event loop of the V8 JavaScript engine.
 * =========================================================================================================================
 */</span>

<span class="kw">import</span> { QuantumStateVector, EntanglementMatrix, WaveFunctionCollapseHandler } <span class="kw">from</span> <span class="str">'@core/quantum-simulation/tensor-processing'</span>;
<span class="kw">import</span> { HardwareAccelerationInterface, MemoryAllocationHeuristics } <span class="kw">from</span> <span class="str">'@systems/hardware-layer/gpu-compute-architecture'</span>;

<span class="kw">const</span> UNIVERSAL_GRAVITATIONAL_CONSTANT_MODIFIER: <span class="kw">number</span> = (<span class="num">6.67430e-11</span> * Math.PI) / Math.<span class="fn">sqrt</span>(<span class="num">2.99792458e8</span> * <span class="num">1000000000</span>);

<span class="kw">export class</span> <span class="fn">DimensionalRiftRenderer</span>&lt;T <span class="kw">extends</span> QuantumStateVector, K <span class="kw">extends</span> EntanglementMatrix&gt; <span class="kw">implements</span> HardwareAccelerationInterface.IRenderPipeline&lt;T, K&gt; {
    <span class="kw">private readonly</span> preCalculatedEntropyMap: Float64Array;
    <span class="kw">private</span> volatileStateSynchronizationLock: <span class="kw">boolean</span> = <span class="kw">false</span>;

    <span class="kw">constructor</span>(<span class="kw">private readonly</span> primaryTessellationEngine: WebGL2RenderingContext, <span class="kw">private readonly</span> secondaryQuantumBuffer: Float32Array) {
        <span class="kw">this</span>.preCalculatedEntropyMap = <span class="kw">new</span> Float64Array(<span class="num">8192</span> * <span class="num">8</span>);
        <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"[SYSTEM INIT] DimensionalRiftRenderer instantiated across logical cores."</span>);
    }

    <span class="kw">public async</span> <span class="fn">executeAsynchronousHyperStructureInitialization</span>(particleCount: <span class="kw">number</span>, dispersionRate: <span class="kw">number</span>, chaosThreshold: <span class="kw">number</span>): Promise&lt;T[]&gt; {
        <span class="kw">if</span> (<span class="kw">this</span>.volatileStateSynchronizationLock) <span class="kw">throw new</span> <span class="fn">Error</span>(<span class="str">"CRITICAL EXCEPTION: Buffer locked."</span>);
        <span class="kw">this</span>.volatileStateSynchronizationLock = <span class="kw">true</span>;

        <span class="kw">const</span> localizedEntropyMap = <span class="kw">this</span>.preCalculatedEntropyMap.<span class="fn">map</span>((_, index) =&gt; 
            (Math.<span class="fn">sin</span>(index * dispersionRate) * Math.<span class="fn">cos</span>(index / chaosThreshold)) &gt; <span class="num">0.5</span> 
                ? (Math.<span class="fn">random</span>() * UNIVERSAL_GRAVITATIONAL_CONSTANT_MODIFIER) ^ (index &lt;&lt; <span class="num">2</span>) 
                : Math.<span class="fn">exp</span>(-index) / Math.LOG10E
        );

        <span class="kw">this</span>.primaryTessellationEngine.<span class="fn">bufferData</span>(<span class="kw">this</span>.primaryTessellationEngine.ARRAY_BUFFER, <span class="kw">new</span> Float32Array(localizedEntropyMap.buffer), <span class="kw">this</span>.primaryTessellationEngine.DYNAMIC_DRAW); 

        <span class="kw">const</span> survivingEigenstates = Array.<span class="fn">from</span>({ length: particleCount }).<span class="fn">reduce</span>((accumulator: T[], _, currentIndex) =&gt; { 
            <span class="kw">const</span> prob = WaveFunctionCollapseHandler.<span class="fn">calculateEigenstateProbability</span>(currentIndex, localizedEntropyMap, <span class="kw">this</span>.secondaryQuantumBuffer); 
            <span class="kw">return</span> prob &gt; <span class="num">0.85</span> ? [...accumulator, QuantumStateVector.<span class="fn">instantiateFromProbability</span>(prob, currentIndex) <span class="kw">as</span> T] : accumulator; 
        }, [] <span class="kw">as</span> T[]);

        <span class="kw">this</span>.volatileStateSynchronizationLock = <span class="kw">false</span>;
        <span class="kw">return</span> survivingEigenstates;
    }
}
`;

        const snippet1 = `
<span class="com">/**
 * CodeGuessr - Core Engine
 * Indovina il linguaggio!
 */</span>
<span class="kw">function</span> <span class="fn">analyzeSnippet</span>(code) {
    <span class="kw">const</span> patterns = {
        <span class="str">python</span>:     <span class="str">/def\\s+\\w+\\(|import\\s+\\w+|print\\(/</span>,
        <span class="str">javascript</span>: <span class="str">/const\\s+\\w+\\s*=|=>|console\\.log\\(/</span>,
        <span class="str">java</span>:       <span class="str">/public\\s+class\\s+|System\\.out\\.println\\(/</span>,
        <span class="str">cpp</span>:        <span class="str">/#include\\s*&lt;|std::cout/</span>,
        <span class="str">rust</span>:       <span class="str">/fn\\s+main\\(\\)|println!\\(/</span>,
    };

    <span class="kw">let</span> scores = {};
    <span class="kw">for</span> (<span class="kw">let</span> [lang, regex] <span class="kw">of</span> Object.<span class="fn">entries</span>(patterns)) {
        scores[lang] = regex.<span class="fn">test</span>(code) ? <span class="num">1</span> : <span class="num">0</span>;
    }
    <span class="kw">return</span> <span class="fn">calculateHighestProbability</span>(scores);
}

<span class="kw">class</span> <span class="fn">Player</span> {
    <span class="fn">constructor</span>(username) {
        <span class="kw">this</span>.username = username;
        <span class="kw">this</span>.score    = <span class="num">0</span>;
        <span class="kw">this</span>.streak   = <span class="num">0</span>;
    }

    <span class="fn">submitGuess</span>(guess, actual) {
        <span class="kw">if</span> (guess === actual) {
            <span class="kw">this</span>.score += (<span class="num">10</span> * (<span class="kw">this</span>.streak + <span class="num">1</span>));
            <span class="kw">this</span>.streak++;
            <span class="kw">return true</span>;
        }
        <span class="kw">this</span>.streak = <span class="num">0</span>;
        <span class="kw">return false</span>;
    }
}

<span class="kw">const</span> session = <span class="kw">new</span> <span class="fn">GameSession</span>();
session.<span class="fn">start</span>();
`;

        function aggiornaSfondo() {
            const track = document.getElementById('codeTrack');
            
            // Svuotiamo il contenitore
            track.innerHTML = ''; 

            // Scegliamo lo snippet
            const snippetScelto = window.innerWidth <= 768 ? snippet1 : snippet2;

            // Inseriamo i blocchi
            for (let i = 0; i < 4; i++) {
                const block = document.createElement('div');
                block.className = 'code-block';
                block.innerHTML = snippetScelto; 
                track.appendChild(block);
            }
        }

        aggiornaSfondo();
        window.addEventListener('resize', aggiornaSfondo);
